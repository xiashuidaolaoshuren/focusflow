package com.focusflow.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.focusflow.testsupport.PostgresTestcontainerConfig;
import java.sql.Connection;
import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class V5MigrationTest {

	@Container
	static final PostgreSQLContainer<?> postgres =
			new PostgreSQLContainer<>("postgres:16-alpine")
					.withDatabaseName("focusflow_v5")
					.withUsername("focusflow")
					.withPassword("focusflow");

	@BeforeAll
	static void configureDockerOnWindows() {
		PostgresTestcontainerConfig.configureWindowsDockerStrategy();
	}

	@AfterAll
	static void stopContainer() {
		postgres.stop();
	}

	@Test
	void v5Migration_backfillsExistingPlanIntoRevisionOne() throws Exception {
		migrateTo("4");
		seedV4PlanWithTaskAndBlock();

		migrateTo("5");

		try (Connection connection = openConnection()) {
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM daily_plans")).isEqualTo(1L);
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM tasks")).isEqualTo(2L);

			assertThat(
							queryInteger(
									connection,
									"""
									SELECT remaining_effort_minutes FROM tasks
									WHERE estimated_minutes = 50
									"""))
					.isEqualTo(50);
			assertThat(
							queryInteger(
									connection,
									"""
									SELECT remaining_effort_minutes FROM tasks
									WHERE estimated_minutes IS NULL
									"""))
					.isNull();
			assertThat(
							queryInteger(
									connection,
									"""
									SELECT effort_version FROM tasks
									WHERE estimated_minutes = 50
									"""))
					.isZero();

			assertThat(queryLong(connection, "SELECT COUNT(*) FROM daily_plan_revisions"))
					.isEqualTo(1L);
			assertThat(
							queryInteger(
									connection,
									"""
									SELECT revision_number FROM daily_plan_revisions
									"""))
					.isEqualTo(1);
			assertThat(
							queryInteger(
									connection,
									"""
									SELECT free_minutes FROM daily_plan_revisions
									"""))
					.isEqualTo(420);
			assertThat(
							queryInteger(
									connection,
									"""
									SELECT scheduled_work_minutes FROM daily_plan_revisions
									"""))
					.isEqualTo(180);
			assertThat(
							queryLong(
									connection,
									"""
									SELECT required_minutes FROM daily_plan_revisions
									"""))
					.isEqualTo(240L);
			assertThat(
							queryInteger(
									connection,
									"""
									SELECT requested_buffer_minutes FROM daily_plan_revisions
									"""))
					.isEqualTo(15);
			assertThat(
							queryInteger(
									connection,
									"""
									SELECT realized_buffer_minutes FROM daily_plan_revisions
									"""))
					.isEqualTo(10);
			assertThat(
							queryObject(
									connection,
									"""
									SELECT cutoff_time FROM daily_plan_revisions
									"""))
					.isNull();

			assertThat(queryLong(connection, "SELECT COUNT(*) FROM daily_plan_tasks"))
					.isEqualTo(1L);
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM daily_plan_blocks"))
					.isEqualTo(1L);
			assertThat(
							queryLong(
									connection,
									"""
									SELECT COUNT(*)
									FROM daily_plan_tasks t
									JOIN daily_plan_revisions r ON r.id = t.revision_id
									"""))
					.isEqualTo(1L);
			assertThat(
							queryLong(
									connection,
									"""
									SELECT COUNT(*)
									FROM daily_plan_blocks b
									JOIN daily_plan_revisions r ON r.id = b.revision_id
									"""))
					.isEqualTo(1L);

			assertThat(columnExists(connection, "daily_plans", "free_minutes")).isFalse();
			assertThat(columnExists(connection, "daily_plans", "scheduled_work_minutes"))
					.isFalse();
			assertThat(columnExists(connection, "daily_plans", "required_minutes")).isFalse();
			assertThat(columnExists(connection, "daily_plans", "requested_buffer_minutes"))
					.isFalse();
			assertThat(columnExists(connection, "daily_plans", "realized_buffer_minutes"))
					.isFalse();

			assertThat(columnExists(connection, "daily_plans", "cadence_enabled")).isTrue();
			assertThat(
							queryLong(connection, "SELECT COUNT(*) FROM plan_fixed_break_snapshots"))
					.isZero();
			assertThat(
							queryObject(
									connection,
									"""
									SELECT outcome FROM daily_plan_blocks
									"""))
					.isNull();
		}
	}

	private static void seedV4PlanWithTaskAndBlock() throws Exception {
		try (Connection connection = openConnection()) {
			long ownerId =
					queryLong(
							connection,
							"""
							INSERT INTO users (email, username, password_hash)
							VALUES ('v5-owner@example.com', 'v5-owner', 'hash')
							RETURNING id
							""");
			long taskWithEstimate =
					queryLong(
							connection,
							"""
							INSERT INTO tasks (
							    owner_id, title, priority, status, estimated_minutes
							) VALUES (?, 'Estimated task', 'MEDIUM', 'OPEN', 50)
							RETURNING id
							""",
							ownerId);
			queryLong(
					connection,
					"""
					INSERT INTO tasks (
					    owner_id, title, priority, status, estimated_minutes
					) VALUES (?, 'Unknown task', 'MEDIUM', 'OPEN', NULL)
					RETURNING id
					""",
					ownerId);
			long planId =
					queryLong(
							connection,
							"""
							INSERT INTO daily_plans (
							    owner_id, plan_date, created_at, window_start, window_end,
							    free_minutes, scheduled_work_minutes, required_minutes,
							    requested_buffer_minutes, realized_buffer_minutes
							) VALUES (
							    ?, DATE '2026-10-05', NOW(), TIME '09:00', TIME '18:00',
							    420, 180, 240, 15, 10
							)
							RETURNING id
							""",
							ownerId);
			long planTaskId =
					queryLong(
							connection,
							"""
							INSERT INTO daily_plan_tasks (
							    daily_plan_id, rank, source_task_id, task_title, task_priority,
							    task_status, must_include
							) VALUES (?, 1, ?, 'Estimated task', 'MEDIUM', 'OPEN', FALSE)
							RETURNING id
							""",
							planId,
							taskWithEstimate);
			queryLong(
					connection,
					"""
					INSERT INTO daily_plan_blocks (
					    daily_plan_id, daily_plan_task_id, kind, start_time, end_time, position
					) VALUES (?, ?, 'WORK', TIME '09:00', TIME '10:00', 1)
					RETURNING id
					""",
					planId,
					planTaskId);
		}
	}

	private static void migrateTo(String version) {
		Flyway.configure()
				.dataSource(
						postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
				.locations("classpath:db/migration")
				.target(MigrationVersion.fromVersion(version))
				.load()
				.migrate();
	}

	private static Connection openConnection() throws Exception {
		return DriverManager.getConnection(
				postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
	}

	private static long queryLong(Connection connection, String sql, Object... params)
			throws Exception {
		try (var statement = connection.prepareStatement(sql)) {
			bindParams(statement, params);
			try (var resultSet = statement.executeQuery()) {
				resultSet.next();
				return resultSet.getLong(1);
			}
		}
	}

	private static Integer queryInteger(Connection connection, String sql, Object... params)
			throws Exception {
		try (var statement = connection.prepareStatement(sql)) {
			bindParams(statement, params);
			try (var resultSet = statement.executeQuery()) {
				resultSet.next();
				int value = resultSet.getInt(1);
				return resultSet.wasNull() ? null : value;
			}
		}
	}

	private static Object queryObject(Connection connection, String sql, Object... params)
			throws Exception {
		try (var statement = connection.prepareStatement(sql)) {
			bindParams(statement, params);
			try (var resultSet = statement.executeQuery()) {
				resultSet.next();
				return resultSet.getObject(1);
			}
		}
	}

	private static boolean columnExists(Connection connection, String table, String column)
			throws Exception {
		try (var statement =
				connection.prepareStatement(
						"""
						SELECT COUNT(*) > 0
						FROM information_schema.columns
						WHERE table_schema = 'public'
						  AND table_name = ?
						  AND column_name = ?
						""")) {
			statement.setString(1, table);
			statement.setString(2, column);
			try (var resultSet = statement.executeQuery()) {
				resultSet.next();
				return resultSet.getBoolean(1);
			}
		}
	}

	private static void bindParams(java.sql.PreparedStatement statement, Object... params)
			throws Exception {
		for (int index = 0; index < params.length; index++) {
			statement.setObject(index + 1, params[index]);
		}
	}
}

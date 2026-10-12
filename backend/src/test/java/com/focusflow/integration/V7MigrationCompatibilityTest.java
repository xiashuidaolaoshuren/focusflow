package com.focusflow.integration;

import static org.assertj.core.api.Assertions.assertThat;

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
class V7MigrationCompatibilityTest {

	@Container
	static final PostgreSQLContainer<?> postgres =
			new PostgreSQLContainer<>("postgres:16-alpine")
					.withDatabaseName("focusflow_v7")
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
	void v7Migration_preservesV6DataAndBackfillsHorizonDefaults() throws Exception {
		migrateTo("6");
		SeedState seed = seedV6State();

		migrateToLatest();

		try (Connection connection = openConnection()) {
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM users")).isEqualTo(1L);
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM tasks")).isEqualTo(1L);
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM scheduling_preferences"))
					.isEqualTo(1L);
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM daily_plans")).isEqualTo(1L);
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM daily_plan_revisions"))
					.isEqualTo(1L);
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM daily_plan_tasks")).isEqualTo(1L);
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM commitments")).isEqualTo(1L);
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM remaining_effort_checkpoints"))
					.isEqualTo(1L);

			assertThat(
							queryObject(
									connection,
									"""
									SELECT captured_checkpoint_id FROM daily_plan_tasks WHERE id = ?
									""",
									seed.planTaskId()))
					.isNull();
			assertThat(
							queryLong(
									connection,
									"""
									SELECT COUNT(*) FROM daily_plan_revision_dependencies
									WHERE revision_id = ?
									""",
									seed.revisionId()))
					.isZero();
			assertThat(queryLong(connection, "SELECT COUNT(*) FROM task_dependencies")).isZero();

			assertThat(
							queryBoolean(
									connection,
									"""
									SELECT working_monday AND working_tuesday AND working_wednesday
									       AND working_thursday AND working_friday
									       AND NOT working_saturday AND NOT working_sunday
									FROM scheduling_preferences
									WHERE owner_id = ?
									""",
									seed.ownerId()))
					.isTrue();
		}
	}

	private static SeedState seedV6State() throws Exception {
		try (Connection connection = openConnection()) {
			long ownerId =
					queryLong(
							connection,
							"""
							INSERT INTO users (email, username, password_hash)
							VALUES ('v7-compat@example.com', 'v7-compat-owner', 'hash')
							RETURNING id
							""");
			long taskId =
					queryLong(
							connection,
							"""
							INSERT INTO tasks (
							    owner_id, title, priority, status, estimated_minutes,
							    remaining_effort_minutes, effort_version
							) VALUES (?, 'Seeded task', 'MEDIUM', 'OPEN', 60, 60, 0)
							RETURNING id
							""",
							ownerId);
			queryLong(
					connection,
					"""
					INSERT INTO scheduling_preferences (
					    owner_id, work_day_start, work_day_end, cadence_enabled,
					    target_focus_minutes, break_minutes, min_session_minutes, buffer_minutes
					) VALUES (?, TIME '09:00', TIME '18:00', TRUE, 50, 10, 15, 0)
					RETURNING id
					""",
					ownerId);
			long planId =
					queryLong(
							connection,
							"""
							INSERT INTO daily_plans (
							    owner_id, plan_date, created_at, window_start, window_end
							) VALUES (?, DATE '2026-10-12', NOW(), TIME '09:00', TIME '18:00')
							RETURNING id
							""",
							ownerId);
			long revisionId =
					queryLong(
							connection,
							"""
							INSERT INTO daily_plan_revisions (
							    daily_plan_id, revision_number, free_minutes, scheduled_work_minutes,
							    required_minutes, requested_buffer_minutes, realized_buffer_minutes,
							    created_at
							) VALUES (?, 1, 480, 60, 60, 0, 0, NOW())
							RETURNING id
							""",
							planId);
			long planTaskId =
					queryLong(
							connection,
							"""
							INSERT INTO daily_plan_tasks (
							    revision_id, rank, source_task_id, task_title, task_priority,
							    task_status, must_include
							) VALUES (?, 1, ?, 'Seeded task', 'MEDIUM', 'OPEN', FALSE)
							RETURNING id
							""",
							revisionId,
							taskId);
			queryLong(
					connection,
					"""
					INSERT INTO commitments (
					    owner_id, title, commitment_date, start_time, end_time
					) VALUES (?, 'Standup', DATE '2026-10-12', TIME '10:00', TIME '10:30')
					RETURNING id
					""",
					ownerId);
			queryLong(
					connection,
					"""
					INSERT INTO remaining_effort_checkpoints (
					    owner_id, source_task_id, work_date, recorded_at, assessed_remaining_minutes
					) VALUES (?, ?, DATE '2026-10-11', NOW(), 45)
					RETURNING id
					""",
					ownerId,
					taskId);

			return new SeedState(ownerId, revisionId, planTaskId);
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

	private static void migrateToLatest() {
		Flyway.configure()
				.dataSource(
						postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
				.locations("classpath:db/migration")
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

	private static boolean queryBoolean(Connection connection, String sql, Object... params)
			throws Exception {
		try (var statement = connection.prepareStatement(sql)) {
			bindParams(statement, params);
			try (var resultSet = statement.executeQuery()) {
				resultSet.next();
				return resultSet.getBoolean(1);
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

	private static void bindParams(java.sql.PreparedStatement statement, Object... params)
			throws Exception {
		for (int index = 0; index < params.length; index++) {
			statement.setObject(index + 1, params[index]);
		}
	}

	private record SeedState(long ownerId, long revisionId, long planTaskId) {}
}

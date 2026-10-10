package com.focusflow.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.focusflow.testsupport.PostgresTestcontainerConfig;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class V6MigrationTest {

	@Container
	static final PostgreSQLContainer<?> postgres =
			new PostgreSQLContainer<>("postgres:16-alpine")
					.withDatabaseName("focusflow_v6")
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
	void v6Migration_allowsZeroRemainingEffortForFinishedTasks() throws Exception {
		migrateToLatest();

		try (Connection connection = openConnection()) {
			long ownerId = insertOwner(connection, "v6-done-owner");

			long finishedTaskId =
					insertTask(connection, ownerId, "Finished task", "DONE", null, 0);

			assertThat(queryInteger(connection, "SELECT remaining_effort_minutes FROM tasks WHERE id = ?", finishedTaskId))
					.isZero();

			// A task completed before this milestone carries its backfilled estimate.
			insertTask(connection, ownerId, "Legacy finished task", "DONE", 50, 50);
			assertThat(
							queryLong(
									connection,
									"""
									SELECT COUNT(*) FROM tasks
									WHERE status = 'DONE' AND remaining_effort_minutes = 50
									"""))
					.isEqualTo(1L);
		}
	}

	@Test
	void v6Migration_stillRejectsZeroRemainingEffortForUnfinishedTasks() throws Exception {
		migrateToLatest();

		try (Connection connection = openConnection()) {
			long ownerId = insertOwner(connection, "v6-unfinished-owner");

			assertThatThrownBy(
							() -> insertTask(connection, ownerId, "Open task", "OPEN", null, 0))
					.isInstanceOf(SQLException.class);
			assertThatThrownBy(
							() ->
									insertTask(
											connection,
											ownerId,
											"In progress task",
											"IN_PROGRESS",
											null,
											0))
					.isInstanceOf(SQLException.class);
		}
	}

	private static long insertOwner(Connection connection, String username) throws Exception {
		return queryLong(
				connection,
				"""
				INSERT INTO users (email, username, password_hash)
				VALUES (?, ?, 'hash')
				RETURNING id
				""",
				username + "@example.com",
				username);
	}

	private static long insertTask(
			Connection connection,
			long ownerId,
			String title,
			String status,
			Integer estimatedMinutes,
			Integer remainingEffortMinutes)
			throws Exception {
		return queryLong(
				connection,
				"""
				INSERT INTO tasks (
				    owner_id, title, priority, status, estimated_minutes, remaining_effort_minutes
				) VALUES (?, ?, 'MEDIUM', ?, ?, ?)
				RETURNING id
				""",
				ownerId,
				title,
				status,
				estimatedMinutes,
				remainingEffortMinutes);
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

	private static void bindParams(java.sql.PreparedStatement statement, Object... params)
			throws Exception {
		for (int index = 0; index < params.length; index++) {
			statement.setObject(index + 1, params[index]);
		}
	}
}

package com.focusflow.schema;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.focusflow.testsupport.PostgresTestcontainerConfig;
import java.sql.Connection;
import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LegacySchemaAdoptionPreflightTest {

	@Container
	static final PostgreSQLContainer<?> postgres =
			new PostgreSQLContainer<>("postgres:16-alpine")
					.withDatabaseName("focusflow_preflight")
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
	@Order(1)
	void rejectsEmptySchema() throws Exception {
		try (Connection connection = openConnection()) {
			assertThatThrownBy(() -> new LegacySchemaAdoptionPreflight().check(connection))
					.isInstanceOf(LegacySchemaMismatchException.class);
		}
	}

	@Test
	@Order(2)
	void acceptsMigratedV1() throws Exception {
		migrateV1();

		try (Connection connection = openConnection()) {
			assertThatCode(() -> new LegacySchemaAdoptionPreflight().check(connection))
					.doesNotThrowAnyException();
		}
	}

	@Nested
	@Testcontainers
	@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
	class AdoptionCommand {

		@Container
		static final PostgreSQLContainer<?> postgres =
				new PostgreSQLContainer<>("postgres:16-alpine")
						.withDatabaseName("focusflow_adopt")
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
		@Order(1)
		void adoptOnMismatchedSchemaDoesNotWriteFlywayHistory() throws Exception {
			assertThatThrownBy(
							() ->
									LegacySchemaAdoptionCommand.adopt(
											postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()))
					.isInstanceOf(LegacySchemaMismatchException.class);

			try (Connection connection = openConnection();
					var statement =
							connection.prepareStatement(
									"SELECT to_regclass('public.flyway_schema_history') IS NOT NULL AS present");
					var resultSet = statement.executeQuery()) {
				resultSet.next();
				assertThat(resultSet.getBoolean("present")).isFalse();
			}
		}

		@Test
		@Order(2)
		void adoptOnMatchingLegacySchemaBaselinesVersion1() throws Exception {
			applyV1WithoutFlywayHistory();

			LegacySchemaAdoptionCommand.adopt(
					postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());

			try (Connection connection = openConnection();
					var statement =
							connection.prepareStatement(
									"""
									SELECT version, success
									FROM flyway_schema_history
									WHERE version = '1'
									""");
					var resultSet = statement.executeQuery()) {
				assertThat(resultSet.next()).isTrue();
				assertThat(resultSet.getBoolean("success")).isTrue();
			}
		}

		@Test
		@Order(3)
		void adoptRefusesWhenFlywayHistoryAlreadyExists() throws Exception {
			applyV1WithoutFlywayHistory();
			LegacySchemaAdoptionCommand.adopt(
					postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());

			assertThatThrownBy(
							() ->
									LegacySchemaAdoptionCommand.adopt(
											postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()))
					.isInstanceOf(IllegalStateException.class);
		}

	private static void applyV1WithoutFlywayHistory() throws Exception {
		Flyway.configure()
				.dataSource(
						postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
				.locations("classpath:db/migration")
				.target(MigrationVersion.fromVersion("1"))
				.load()
				.migrate();

			try (Connection connection = openConnection();
					var statement = connection.createStatement()) {
				statement.execute("DROP TABLE IF EXISTS flyway_schema_history");
			}
		}

		private static Connection openConnection() throws Exception {
			return DriverManager.getConnection(
					postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
		}
	}

	private static Connection openConnection() throws Exception {
		return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
	}

	private static void migrateV1() {
		Flyway.configure()
				.dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
				.locations("classpath:db/migration")
				.target(MigrationVersion.fromVersion("1"))
				.load()
				.migrate();
	}
}

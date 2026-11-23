package com.focusflow.openapi;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import com.focusflow.testsupport.DailyPlanAiTestConfiguration;
import com.focusflow.testsupport.PostgresTestcontainerConfig;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.oas.models.OpenAPI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "dev"})
@Import({DailyPlanAiTestConfiguration.class, PostgresTestcontainerConfig.class})
class OpenApiSnapshotTest {

	private static final Path SNAPSHOT_PATH =
			Path.of("..", "docs", "openapi.yaml").normalize().toAbsolutePath();

	private static final ObjectMapper YAML_MAPPER =
			new ObjectMapper(
							YAMLFactory.builder()
									.disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
									.build())
					.findAndRegisterModules()
					.configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);

	@Autowired
	private MockMvc mockMvc;

	@Test
	void horizonCurrentTimeQueryParameterIsLocalTimeString() throws Exception {
		OpenAPI doc = fetchOpenApiDocument();
		var horizonPath = doc.getPaths().get("/api/horizon");
		assertThat(horizonPath).isNotNull();
		var operation = horizonPath.getGet();
		assertThat(operation).isNotNull();
		var currentTimeParam =
				operation.getParameters().stream()
						.filter(p -> "currentTime".equals(p.getName()) && "query".equals(p.getIn()))
						.findFirst()
						.orElseThrow();
		var schema = currentTimeParam.getSchema();
		assertThat(schema.getType()).isEqualTo("string");
		assertThat(schema.getExample()).isEqualTo("09:00:00");
		assertThat(schema.getFormat()).isNull();
	}

	@Test
	void generatedSnapshotMatchesCommitted() throws Exception {
		String generated = normalizeToYaml(fetchOpenApiDocument());

		if (Boolean.getBoolean("updateOpenApiSnapshot")) {
			Files.writeString(SNAPSHOT_PATH, generated + System.lineSeparator());
			return;
		}

		String committed = normalizeYaml(Files.readString(SNAPSHOT_PATH));
		assertThat(generated).isEqualTo(committed);
	}

	private OpenAPI fetchOpenApiDocument() throws Exception {
		String json =
				mockMvc.perform(get("/v3/api-docs"))
						.andExpect(status().isOk())
						.andReturn()
						.getResponse()
						.getContentAsString();
		return Json.mapper().readValue(json, OpenAPI.class);
	}

	static String normalizeToYaml(OpenAPI openAPI) throws Exception {
		String rawYaml = io.swagger.v3.core.util.Yaml.mapper().writeValueAsString(openAPI);
		return normalizeYaml(rawYaml);
	}

	static String normalizeYaml(String yaml) throws Exception {
		JsonNode normalized = normalizeNode(YAML_MAPPER.readTree(yaml));
		return YAML_MAPPER.writeValueAsString(normalized).stripTrailing();
	}

	private static JsonNode normalizeNode(JsonNode node) {
		if (node == null || node.isNull()) {
			return node;
		}
		if (node.isObject()) {
			ObjectNode normalized = YAML_MAPPER.createObjectNode();
			List<String> fieldNames = new ArrayList<>();
			node.fieldNames().forEachRemaining(fieldNames::add);
			fieldNames.sort(Comparator.naturalOrder());
			for (String fieldName : fieldNames) {
				if ("servers".equals(fieldName)) {
					continue;
				}
				normalized.set(fieldName, normalizeNode(node.get(fieldName)));
			}
			return normalized;
		}
		if (node.isArray()) {
			ArrayNode normalized = YAML_MAPPER.createArrayNode();
			for (JsonNode element : node) {
				normalized.add(normalizeNode(element));
			}
			return normalized;
		}
		return node;
	}
}

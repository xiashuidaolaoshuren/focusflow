package com.focusflow.common.error;

import com.focusflow.ai.AiProviderException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/__test/errors")
public class GlobalExceptionHandlerTestController {

	@GetMapping("/not-found")
	void notFound() {
		throw new NotFoundException("missing");
	}

	@GetMapping("/forbidden")
	void forbidden() {
		throw new ForbiddenOperationException("nope");
	}

	@GetMapping("/ai-provider")
	void aiProvider() {
		throw new AiProviderException("provider failed");
	}

	@GetMapping("/generic")
	void generic() {
		throw new RuntimeException("boom");
	}

	@GetMapping("/conflict")
	void conflict(@org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean coded) {
		if (coded) {
			throw new ConflictException("PLAN_EXISTS", "plan already exists");
		}
		throw new ConflictException("plan already exists");
	}

	@GetMapping("/bad-request")
	void badRequest(@org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean coded) {
		if (coded) {
			throw new BadRequestException("PLAN_CANDIDATE_LIMIT", "too many candidates");
		}
		throw new BadRequestException("invalid request");
	}

	@PostMapping("/validation")
	void validation(@Valid @RequestBody ValidationDto body) {
		throw new IllegalStateException("should not run: " + body);
	}

	static class ValidationDto {
		@NotBlank
		private String name;

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}
	}
}

package com.focusflow.commitment;

import com.focusflow.commitment.dto.CommitmentRequest;
import com.focusflow.commitment.dto.CommitmentResponse;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/commitments")
public class CommitmentController {

	private final CommitmentService commitmentService;

	public CommitmentController(CommitmentService commitmentService) {
		this.commitmentService = commitmentService;
	}

	@GetMapping
	public List<CommitmentResponse> list(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
					LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
					LocalDate to) {
		return commitmentService.list(from, to);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public CommitmentResponse create(@Valid @RequestBody CommitmentRequest request) {
		return commitmentService.create(request);
	}

	@PutMapping("/{id}")
	public CommitmentResponse update(
			@PathVariable Long id, @Valid @RequestBody CommitmentRequest request) {
		return commitmentService.update(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable Long id) {
		commitmentService.delete(id);
	}
}

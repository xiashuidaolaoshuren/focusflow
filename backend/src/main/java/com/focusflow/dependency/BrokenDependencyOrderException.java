package com.focusflow.dependency;

public class BrokenDependencyOrderException extends RuntimeException {

	public BrokenDependencyOrderException(String message) {
		super(message);
	}
}

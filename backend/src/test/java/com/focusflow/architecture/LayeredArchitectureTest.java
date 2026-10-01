package com.focusflow.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "com.focusflow")
class LayeredArchitectureTest {

	private static final DescribedPredicate<JavaClass> TASK_REPOSITORIES =
			DescribedPredicate.describe(
					"task repositories",
					javaClass ->
							javaClass.getPackageName().contains("com.focusflow.task")
									&& javaClass.getSimpleName().endsWith("Repository"));

	@ArchTest
	static final ArchRule controllers_should_not_access_repositories =
			noClasses()
					.that()
					.haveSimpleNameEndingWith("Controller")
					.should()
					.dependOnClassesThat()
					.haveSimpleNameEndingWith("Repository")
					.because("controllers must delegate to services, not repositories");

	@ArchTest
	static final ArchRule repositories_should_not_depend_on_dtos =
			noClasses()
					.that()
					.haveSimpleNameEndingWith("Repository")
					.should()
					.dependOnClassesThat()
					.resideInAPackage("..dto..")
					.because("repositories persist entities only");

	@ArchTest
	static final ArchRule plan_services_should_not_access_task_repositories =
			noClasses()
					.that()
					.resideInAPackage("..plan..")
					.and()
					.haveSimpleNameEndingWith("Service")
					.should()
					.dependOnClassesThat(TASK_REPOSITORIES)
					.because("plan services must use task facades instead of task repositories");

	@ArchTest
	static final ArchRule task_services_should_not_depend_on_auth_dtos =
			noClasses()
					.that()
					.resideInAPackage("com.focusflow.task")
					.should()
					.dependOnClassesThat()
					.resideInAPackage("com.focusflow.auth.dto")
					.because("task layer must not couple to auth API DTOs");

	@ArchTest
	static final ArchRule schedule_should_not_depend_on_framework_layers =
			noClasses()
					.that()
					.resideInAPackage("com.focusflow.schedule")
					.should()
					.dependOnClassesThat()
					.resideInAnyPackage(
							"org.springframework..", "jakarta.persistence..", "com.focusflow.plan.dto..")
					.because("the scheduler is pure: no Spring, JPA, or plan DTOs");

	@ArchTest
	static final ArchRule security_should_not_depend_on_auth_dtos =
			noClasses()
					.that()
					.resideInAPackage("com.focusflow.security")
					.should()
					.dependOnClassesThat()
					.resideInAPackage("com.focusflow.auth.dto")
					.because("security components expose domain-neutral context, not API DTOs");
}

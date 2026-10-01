package com.focusflow.preferences;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SchedulingPreferencesRepository extends JpaRepository<SchedulingPreferences, Long> {

	Optional<SchedulingPreferences> findByOwner_Id(Long ownerId);
}

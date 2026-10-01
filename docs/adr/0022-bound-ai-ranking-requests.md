# Bound AI ranking requests

One generation accepts at most 100 plannable candidates and truncates each task description to 500 characters in the prompt without changing stored text. Above the cap, generation returns coded 400 `PLAN_CANDIDATE_LIMIT` before spending a provider call. A total ordering requires every candidate id in the output, so unbounded task counts and descriptions would eventually exceed provider context or output limits; batching or deterministic optional shortlisting would add cost or weaken the promised global ranking.

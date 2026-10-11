# Working weekdays shape the horizon and do not gate daily plans

Scheduling preferences store the weekdays included in the horizon, defaulting to Monday through Friday, with at least one day required. The seven-day walk counts only those weekdays. A non-working date appears only when it already has a Daily plan, and it does not consume one of the seven. Generate and re-plan still accept any calendar date.

Counting every calendar day was rejected because a seven-day forecast would treat Saturday and Sunday as full work windows. Refusing to generate a plan on a non-working day was rejected because the owner can still want a schedule for a specific date without changing the forecast.

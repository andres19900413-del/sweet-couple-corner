
ALTER TABLE public.calendar_events
ADD COLUMN reminder_lead_minutes integer DEFAULT 1440;

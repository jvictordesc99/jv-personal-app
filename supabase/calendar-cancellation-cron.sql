-- Optional deployment step, NOT a migration. Review and run only in the intended
-- environment after deploying calendar-cancellation-worker.
-- Create these Vault entries through the dashboard first:
--   calendar_cancellation_worker_url: full HTTPS URL of the worker Edge Function
--   calendar_cancellation_worker_secret: same value as Edge secret
--     CALENDAR_CANCELLATION_WORKER_SECRET
-- Enable pg_cron and pg_net through the dashboard first. No secret literals here.
select cron.schedule(
  'calendar-cancellation-worker',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cancellation_worker_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'calendar_cancellation_worker_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);

-- Concede uso do schema cron ao postgres (necessário para agendar)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove job antigo se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-telegram-updates') THEN
    PERFORM cron.unschedule('poll-telegram-updates');
  END IF;
END $$;

-- Agenda execução a cada minuto
SELECT cron.schedule(
  'poll-telegram-updates',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url:='https://frvklcrendlgovdnzlwr.supabase.co/functions/v1/telegram-poll',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydmtsY3JlbmRsZ292ZG56bHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NzU4NTMsImV4cCI6MjA4MzM1MTg1M30.Wz909ws3BAMIrdD83QFRauk-kQGCn1H-JFlMEys6jdY"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $cron$
);
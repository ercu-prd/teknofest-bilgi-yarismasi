-- TEKNOFEST Bilgi Yarismasi - 1v1 Supabase migration
-- 2026-10-05. Run in Supabase SQL Editor as project owner.
-- REQUIRES: Supabase Auth > Providers > Anonymous sign-ins ENABLED.
-- Frontend MUST signInAnonymously() before any RPC call and use auth user id
-- as player_id. Questions are chosen by server, not sent from the client.
-- Does not drop tables or delete historical rows.
BEGIN;

-- Base schema (works for both new projects and existing first migration).
CREATE TABLE IF NOT EXISTS public.questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('kolay','orta','zor')),
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'LOBBY' CHECK (status IN ('LOBBY','VS','QUIZ','RESULT')),
  match_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  auth_user_id UUID DEFAULT auth.uid(),
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_room_player UNIQUE (room_code,player_id)
);
ALTER TABLE public.room_players ADD COLUMN IF NOT EXISTS auth_user_id UUID;
CREATE TABLE IF NOT EXISTS public.room_player_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  question_id BIGINT NOT NULL,
  selected_option_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_player_question_answer UNIQUE (room_code,player_id,question_id)
);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_room_players_room_code ON public.room_players(room_code);
CREATE INDEX IF NOT EXISTS idx_room_player_answers ON public.room_player_answers(room_code,player_id);

-- Add a modest verified starter bank. Add more questions via SQL Editor later.
-- Correct_index is zero-based and options always have 4 entries.
INSERT INTO public.questions (category,difficulty,question,options,correct_index)
SELECT v.category,v.difficulty,v.question,v.options::jsonb,v.answer
FROM (VALUES
('teknoloji','kolay','CPU neyin kısaltmasıdır?','["Central Processing Unit","Computer Power Utility","Control Program Unit","Core Performance Unit"]',0),
('bilim','kolay','Suyun kimyasal formülü nedir?','["CO2","H2O","O2","NaCl"]',1),
('genel','kolay','Türkiye Cumhuriyeti hangi yılda kuruldu?','["1920","1921","1923","1938"]',2),
('mantık','kolay','2, 4, 6, 8 dizisinde sıradaki sayı nedir?','["9","10","11","12"]',1),
('teknoloji','kolay','HTML öncelikle ne için kullanılır?','["Web sayfasının yapısını oluşturmak","Veritabanı çalıştırmak","Fotoğraf çekmek","İşletim sistemi kurmak"]',0),
('bilim','kolay','Dünya hangi yıldızın etrafında döner?','["Sirius","Kutup Yıldızı","Güneş","Vega"]',2),
('mantık','kolay','5 + 7 × 2 kaçtır?','["24","19","17","14"]',1),
('genel','kolay','Ankara hangi ülkenin başkentidir?','["Azerbaycan","Türkiye","Gürcistan","Kazakistan"]',1),
('teknoloji','kolay','USB ne için yaygın olarak kullanılır?','["Veri aktarımı ve bağlantı","Sadece ses kaydı","Sadece ekran temizliği","Kağıt baskısı"]',0),
('bilim','kolay','İnsanların solunumda kullandığı gaz hangisidir?','["Helyum","Azot","Oksijen","Argon"]',2),
('mantık','kolay','1, 3, 5, 7 dizisinde sıradaki sayı nedir?','["8","9","10","11"]',1),
('genel','kolay','Bir düzinede kaç adet vardır?','["10","11","12","20"]',2),
('teknoloji','orta','HTTP durum kodu 404 neyi belirtir?','["Başarılı işlem","Sunucu kapandı","Kaynak bulunamadı","Yönlendirme"]',2),
('bilim','orta','Elektrik akımının SI birimi nedir?','["Volt","Amper","Ohm","Watt"]',1),
('mantık','orta','2, 6, 12, 20, ? dizisini tamamlayın.','["26","28","30","32"]',2),
('genel','orta','Bir saatte kaç saniye vardır?','["600","1800","3600","6000"]',2),
('teknoloji','orta','SQL hangi alanda yaygın kullanılır?','["Veritabanı sorgulama","3D yazdırma","Görüntü sıkıştırma","Ağ kablolama"]',0),
('bilim','orta','Işığın boşluktaki yaklaşık hızı kaç km/s''dir?','["30.000","150.000","300.000","3.000.000"]',2),
('mantık','orta','3, 9, 27, ? dizisinde sıradaki sayı nedir?','["36","54","81","90"]',2),
('genel','orta','Artık yılda şubat ayı kaç gündür?','["27","28","29","30"]',2),
('teknoloji','orta','IPv4 adresi kaç bittir?','["16","32","64","128"]',1),
('bilim','orta','DNA''nın açılımında D harfi neyi temsil eder?','["Deoksiribo","Dinamik","Dijital","Difüzyon"]',0),
('mantık','orta','Bir sayının yarısı 18 ise üçte biri kaçtır?','["6","9","12","18"]',2),
('genel','orta','Üçgenin iç açılarının toplamı kaç derecedir?','["90","180","270","360"]',1),
('teknoloji','zor','İkili sayı sistemiyle yazılan 101101 kaçtır?','["43","44","45","46"]',2),
('mantık','zor','1, 1, 2, 3, 5, 8, ? dizisini tamamlayın.','["11","12","13","15"]',2),
('bilim','zor','pH değeri 7''den küçük olan çözelti genellikle nasıldır?','["Bazik","Nötr","Asidik","Metalik"]',2),
('teknoloji','zor','Bir ağda DNS temel olarak ne yapar?','["Alan adlarını IP adreslerine eşler","Görüntü işler","Pil şarj eder","Disk biçimlendirir"]',0),
('mantık','zor','Bir zar iki kez atılırsa iki kez 6 gelme olasılığı kaçtır?','["1/6","1/12","1/18","1/36"]',3),
('bilim','zor','Elektrik direncinin SI birimi nedir?','["Farad","Ohm","Tesla","Joule"]',1),
('genel','zor','Bir sayının %20''si 14 ise tamamı kaçtır?','["56","60","70","84"]',2),
('mantık','zor','2, 3, 5, 8, 12, 17, ? dizisi nasıl devam eder?','["21","22","23","24"]',2)
) AS v(category,difficulty,question,options,answer)
WHERE NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.question=v.question);

-- Sanitize OLD test rooms: never expose a stored correct answer in Realtime.
-- Old unfinished matches will need new rooms, as legacy client-generated keys are untrusted.
UPDATE public.rooms r SET match_questions=COALESCE((
  SELECT jsonb_agg(elem.value - 'correctIndex' - 'correct_index' - 'answer' - 'correctAnswer' ORDER BY elem.ordinality)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.match_questions)='array'
    THEN r.match_questions ELSE '[]'::jsonb END) WITH ORDINALITY AS elem(value,ordinality)
),'[]'::jsonb)
WHERE match_questions::text ~ 'correctIndex|correct_index|correctAnswer|"answer"';

-- Restrict all previous open policies, not only known ones.
DO $$ DECLARE p RECORD;
BEGIN
 FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies
          WHERE schemaname='public' AND tablename IN
          ('questions','rooms','room_players','room_player_answers') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
 END LOOP;
END $$;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_player_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.questions,public.rooms,public.room_players,public.room_player_answers
 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.rooms,public.room_players TO authenticated;
-- No direct table writes by browser, no direct reads of answer key.

-- Helper: read visible room state only if this auth user belongs to it.
CREATE OR REPLACE FUNCTION public.is_quiz_room_member(p_code TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS
 (SELECT 1 FROM public.room_players
  WHERE room_code=p_code AND auth_user_id=auth.uid());
$$;
CREATE POLICY rooms_member_select ON public.rooms FOR SELECT TO authenticated
 USING (public.is_quiz_room_member(code));
CREATE POLICY players_member_select ON public.room_players FOR SELECT TO authenticated
 USING (public.is_quiz_room_member(room_code));
-- No read policies for questions / room_player_answers.

-- Remove older, weaker submit_answer overloads.
DROP FUNCTION IF EXISTS public.submit_answer_rpc(TEXT,TEXT,BIGINT,INTEGER,NUMERIC);
DROP FUNCTION IF EXISTS public.submit_answer_rpc(TEXT,TEXT,BIGINT,INTEGER);

-- Room creation: NEVER trust caller-supplied questions or player identity.
-- Keep legacy 5-argument API for front-end compatibility; ignore p_match_questions.
CREATE OR REPLACE FUNCTION public.create_room_rpc(
 p_code TEXT,p_name TEXT,p_avatar TEXT,p_match_questions JSONB,p_player_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID:=auth.uid(); v_code TEXT:=trim(p_code);
 v_questions JSONB:='[]'::jsonb; v_count INT:=0; q RECORD;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum yok (signInAnonymously gerekli)'); END IF;
 IF v_code !~ '^[0-9]{6}$' THEN RETURN jsonb_build_object('success',false,'error','Oda kodu 6 rakam olmalı'); END IF;
 IF length(trim(p_name)) NOT BETWEEN 1 AND 32 THEN RETURN jsonb_build_object('success',false,'error','Geçerli isim girin'); END IF;
 -- Four easy + four medium + two hard questions, shuffled together.
 FOR q IN SELECT * FROM (
   (SELECT id,category,difficulty,question,options FROM public.questions WHERE difficulty='kolay' ORDER BY random() LIMIT 4)
   UNION ALL
   (SELECT id,category,difficulty,question,options FROM public.questions WHERE difficulty='orta' ORDER BY random() LIMIT 4)
   UNION ALL
   (SELECT id,category,difficulty,question,options FROM public.questions WHERE difficulty='zor' ORDER BY random() LIMIT 2)
 ) AS sample ORDER BY random() LOOP
   v_questions:=v_questions || jsonb_build_array(jsonb_build_object(
     'id',q.id,'category',q.category,'difficulty',q.difficulty,
     'question',q.question,'options',q.options));
   v_count:=v_count+1;
 END LOOP;
 IF v_count<>10 THEN RETURN jsonb_build_object('success',false,'error','Yeterli soru bulunamadı (4 kolay, 4 orta, 2 zor gerekli)'); END IF;
 INSERT INTO public.rooms(code,status,match_questions) VALUES(v_code,'LOBBY',v_questions);
 INSERT INTO public.room_players(room_code,player_id,auth_user_id,name,avatar,is_host)
 VALUES(v_code,v_uid::text,v_uid,trim(p_name),coalesce(p_avatar,''),true);
 RETURN jsonb_build_object('success',true,'code',v_code,'player_id',v_uid::text);
EXCEPTION WHEN unique_violation THEN
 RETURN jsonb_build_object('success',false,'error','Kod kullanılıyor, tekrar deneyin');
END;
$$;

CREATE OR REPLACE FUNCTION public.join_room_atomic(
 p_room_code TEXT,p_player_id TEXT,p_name TEXT,p_avatar TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID:=auth.uid(); v_code TEXT:=upper(trim(p_room_code));
 v_status TEXT; v_count INTEGER; v_owner UUID;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 SELECT status INTO v_status FROM public.rooms WHERE code=v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Oda bulunamadı'); END IF;
 SELECT count(*) INTO v_count FROM public.room_players WHERE room_code=v_code;
 IF EXISTS(SELECT 1 FROM public.room_players WHERE room_code=v_code AND auth_user_id=v_uid) THEN
   RETURN jsonb_build_object('success',true,'code',v_code,'player_id',v_uid::text);
 END IF;
 IF v_status<>'LOBBY' THEN RETURN jsonb_build_object('success',false,'error','Maç başlamış'); END IF;
 IF v_count>=2 THEN RETURN jsonb_build_object('success',false,'error','Oda dolu'); END IF;
 IF length(trim(p_name)) NOT BETWEEN 1 AND 32 THEN RETURN jsonb_build_object('success',false,'error','Geçerli isim girin'); END IF;
 INSERT INTO public.room_players(room_code,player_id,auth_user_id,name,avatar,is_host)
 VALUES(v_code,v_uid::text,v_uid,trim(p_name),coalesce(p_avatar,''),false);
 RETURN jsonb_build_object('success',true,'code',v_code,'player_id',v_uid::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_player_ready_and_check_start(
 p_room_code TEXT,p_player_id TEXT,p_ready_state BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid UUID:=auth.uid(); v_code TEXT:=upper(trim(p_room_code));
 v_status TEXT; v_count INTEGER; v_ready INTEGER; v_started BOOLEAN:=false;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum açılmadı'); END IF;
 SELECT status INTO v_status FROM public.rooms WHERE code=v_code FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Oda bulunamadı'); END IF;
 IF NOT EXISTS (SELECT 1 FROM public.room_players WHERE room_code=v_code AND auth_user_id=v_uid) THEN
   RETURN jsonb_build_object('success',false,'error','Bu odanın oyuncusu değilsin'); END IF;
 IF v_status<>'LOBBY' THEN RETURN jsonb_build_object('success',true,'status',v_status,'match_started',false); END IF;
 UPDATE public.room_players SET is_ready=p_ready_state,updated_at=clock_timestamp()
 WHERE room_code=v_code AND auth_user_id=v_uid;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Bu odanın oyuncusu değilsin'); END IF;
 SELECT count(*),count(*) FILTER (WHERE is_ready) INTO v_count,v_ready
 FROM public.room_players WHERE room_code=v_code;
 IF v_count=2 AND v_ready=2 THEN
   -- started_at is the start of Q1 (after 3-second VS countdown).
   UPDATE public.rooms SET status='VS',started_at=clock_timestamp()+interval '3 seconds'
   WHERE code=v_code;
   v_started:=true; v_status:='VS';
 END IF;
 RETURN jsonb_build_object('success',true,'total_players',v_count,'ready_count',v_ready,
   'status',v_status,'match_started',v_started);
END;
$$;

-- Optional helper for existing React code to retrieve questions. Only members may call.
CREATE OR REPLACE FUNCTION public.get_room_questions_masked(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_code TEXT:=upper(trim(p_room_code)); v_questions JSONB;
BEGIN
 IF NOT public.is_quiz_room_member(v_code) THEN RETURN '[]'::jsonb; END IF;
 SELECT match_questions INTO v_questions FROM public.rooms WHERE code=v_code;
 RETURN coalesce(v_questions,'[]'::jsonb);
END;
$$;

-- Timestamp and question position are server-authoritative. Front end receives no answer key.
CREATE OR REPLACE FUNCTION public.submit_answer_rpc(
 p_room_code TEXT,p_player_id TEXT,p_question_id BIGINT,p_selected_option_index INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid UUID:=auth.uid(); v_code TEXT:=upper(trim(p_room_code));
 v_status TEXT; v_start TIMESTAMPTZ; v_questions JSONB;
 v_ordinal BIGINT; v_correct INTEGER; v_elapsed DOUBLE PRECISION;
 v_in_question DOUBLE PRECISION; v_bonus INTEGER; v_points INTEGER;
 v_is_correct BOOLEAN; v_score INTEGER;
BEGIN
 IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','Oturum yok'); END IF;
 IF p_selected_option_index NOT BETWEEN 0 AND 3 THEN
   RETURN jsonb_build_object('success',false,'error','Geçersiz şık'); END IF;
 SELECT status,started_at,match_questions INTO v_status,v_start,v_questions
 FROM public.rooms WHERE code=v_code FOR UPDATE;
 IF NOT FOUND OR v_status NOT IN ('VS','QUIZ') OR v_start IS NULL THEN
   RETURN jsonb_build_object('success',false,'error','Aktif maç yok'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.room_players WHERE room_code=v_code AND auth_user_id=v_uid) THEN
   RETURN jsonb_build_object('success',false,'error','Bu odada değilsin'); END IF;
 v_elapsed:=extract(epoch from(clock_timestamp()-v_start));
 IF v_elapsed<0 OR v_elapsed>=90 THEN
   RETURN jsonb_build_object('success',false,'error','Soru henüz başlamadı veya maç bitti'); END IF;
 SELECT x.ordinality INTO v_ordinal
 FROM jsonb_array_elements(v_questions) WITH ORDINALITY AS x(item,ordinality)
 WHERE (x.item->>'id')::BIGINT=p_question_id;
 IF v_ordinal IS NULL OR v_ordinal<>floor(v_elapsed/9)::BIGINT+1 THEN
   RETURN jsonb_build_object('success',false,'error','Bu soru şu anda aktif değil'); END IF;
 v_in_question:=v_elapsed-((v_ordinal-1)*9);
 SELECT correct_index INTO v_correct FROM public.questions WHERE id=p_question_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Soru bulunamadı'); END IF;
 v_is_correct:=(v_correct=p_selected_option_index);
 v_bonus:=greatest(0,least(50,floor((9-v_in_question)*50/9)::INTEGER));
 v_points:=CASE WHEN v_is_correct THEN 100+v_bonus ELSE 0 END;
 -- Room lock serializes duplicate submissions. Unique constraint is backup.
 IF EXISTS(SELECT 1 FROM public.room_player_answers
           WHERE room_code=v_code AND player_id=v_uid::text AND question_id=p_question_id) THEN
   RETURN jsonb_build_object('success',false,'error','Bu soru zaten cevaplandı'); END IF;
 INSERT INTO public.room_player_answers(room_code,player_id,question_id,
   selected_option_index,is_correct,points_awarded)
 VALUES(v_code,v_uid::text,p_question_id,p_selected_option_index,v_is_correct,v_points);
 UPDATE public.room_players
 SET score=score+v_points,correct_answers=correct_answers+(CASE WHEN v_is_correct THEN 1 ELSE 0 END),
     streak=CASE WHEN v_is_correct THEN streak+1 ELSE 0 END,updated_at=clock_timestamp()
 WHERE room_code=v_code AND auth_user_id=v_uid RETURNING score INTO v_score;
 RETURN jsonb_build_object('success',true,'is_correct',v_is_correct,
   'points_added',v_points,'new_score',v_score);
END;
$$;

-- If client needs to mark end-of-match, allow only after actual 90 seconds elapsed.
CREATE OR REPLACE FUNCTION public.finish_room_rpc(p_room_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_code TEXT:=upper(trim(p_room_code)); v_start TIMESTAMPTZ;
BEGIN
 IF NOT public.is_quiz_room_member(v_code) THEN
   RETURN jsonb_build_object('success',false,'error','Bu odanın oyuncusu değilsin'); END IF;
 SELECT started_at INTO v_start FROM public.rooms WHERE code=v_code FOR UPDATE;
 IF v_start IS NULL OR clock_timestamp()<v_start+interval '90 seconds' THEN
   RETURN jsonb_build_object('success',false,'error','Süre henüz bitmedi'); END IF;
 UPDATE public.rooms SET status='RESULT' WHERE code=v_code AND status IN ('VS','QUIZ');
 RETURN jsonb_build_object('success',true,'status','RESULT');
END;
$$;

-- Remove PUBLIC execution of every game function; allow signed-in anonymous Auth users.
DO $$ DECLARE f RECORD;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN
   ('create_room_rpc','join_room_atomic','set_player_ready_and_check_start',
    'get_room_questions_masked','submit_answer_rpc','finish_room_rpc','is_quiz_room_member') LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f.signature);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
 END LOOP;
END $$;

-- Allow Realtime changes for room + players. Questions/answers are NOT published.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
 AND schemaname='public' AND tablename='rooms') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
 AND schemaname='public' AND tablename='room_players') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
 END IF;
END $$;
COMMIT;

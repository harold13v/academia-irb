CREATE TABLE "achievements" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"rule" jsonb NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle_members" (
	"circle_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "circle_members_circle_id_user_id_pk" PRIMARY KEY("circle_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "circles" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"name" text NOT NULL,
	"size" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover" text,
	"wp_course_id" integer,
	"kind" text DEFAULT 'course' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "courses_wp_course_id_unique" UNIQUE("wp_course_id")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"user_id" uuid NOT NULL,
	"course_id" integer NOT NULL,
	"origin" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"external_ref" text,
	CONSTRAINT "enrollments_user_id_course_id_pk" PRIMARY KEY("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "gamification_rules" (
	"key" text PRIMARY KEY NOT NULL,
	"amount" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"user_id" uuid NOT NULL,
	"lesson_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"position_s" integer DEFAULT 0 NOT NULL,
	"watched_s" integer DEFAULT 0 NOT NULL,
	"percent" smallint DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_progress_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"position" integer NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"media_type" text NOT NULL,
	"media_url" text,
	"vimeo_id" text,
	"vimeo_hash" text,
	"poster" text,
	"duration_s" integer DEFAULT 0 NOT NULL,
	"body_html" text DEFAULT '' NOT NULL,
	"prep" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_free" boolean DEFAULT false NOT NULL,
	"playable_in_staging" boolean DEFAULT false NOT NULL,
	"wp_lesson_id" integer
);
--> statement-breakpoint
CREATE TABLE "levels" (
	"level" smallint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"threshold" integer NOT NULL,
	"unlock_lesson_id" integer,
	"unlock_label" text
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" integer NOT NULL,
	"position_s" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_days" (
	"subject" text NOT NULL,
	"day" date NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"goal_met" boolean DEFAULT false NOT NULL,
	"pause" boolean DEFAULT false NOT NULL,
	CONSTRAINT "practice_days_subject_day_pk" PRIMARY KEY("subject","day")
);
--> statement-breakpoint
CREATE TABLE "subject_stats" (
	"subject" text PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" smallint DEFAULT 1 NOT NULL,
	"days_practiced" integer DEFAULT 0 NOT NULL,
	"current_run" integer DEFAULT 0 NOT NULL,
	"best_run" integer DEFAULT 0 NOT NULL,
	"pauses_used_month" smallint DEFAULT 0 NOT NULL,
	"last_practice_day" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"subject" text NOT NULL,
	"key" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_subject_key_pk" PRIMARY KEY("subject","key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"wp_user_id" integer,
	"password_hash" text,
	"password_algo" text,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"daily_goal_min" smallint DEFAULT 10 NOT NULL,
	"circles_opt_in" boolean DEFAULT false NOT NULL,
	"sound_on" boolean DEFAULT false NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_wp_user_id_unique" UNIQUE("wp_user_id")
);
--> statement-breakpoint
CREATE TABLE "xp_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"source" text NOT NULL,
	"ref_id" text,
	"amount" integer NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_unlock_lesson_id_lessons_id_fk" FOREIGN KEY ("unlock_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_key_achievements_key_fk" FOREIGN KEY ("key") REFERENCES "public"."achievements"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cm_user" ON "circle_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "circles_week" ON "circles" USING btree ("week_start","size");--> statement-breakpoint
CREATE UNIQUE INDEX "events_idem" ON "events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "events_pending" ON "events" USING btree ("id") WHERE processed_at is null;--> statement-breakpoint
CREATE INDEX "events_name_ts" ON "events" USING btree ("name","ts");--> statement-breakpoint
CREATE INDEX "lp_user_course" ON "lesson_progress" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "lp_user_updated" ON "lesson_progress" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_course_slug" ON "lessons" USING btree ("course_id","slug");--> statement-breakpoint
CREATE INDEX "lessons_course_pos" ON "lessons" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "modules_course_pos" ON "modules" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "notes_user_lesson" ON "notes" USING btree ("user_id","lesson_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "xp_idem" ON "xp_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "xp_subject_ts" ON "xp_ledger" USING btree ("subject","ts");
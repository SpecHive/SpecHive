DROP INDEX "refresh_tokens_user_id_idx";--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_active_user_idx" ON "refresh_tokens" USING btree ("user_id") WHERE revoked_at IS NULL;
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(255),
	"token" varchar(255) NOT NULL,
	"role" "membership_role" NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_org_status_idx" ON "invitations" USING btree ("organization_id","status");--> statement-breakpoint

-- updated_at trigger
CREATE OR REPLACE TRIGGER set_updated_at_invitations
  BEFORE UPDATE ON "invitations"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();--> statement-breakpoint

-- RLS
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "invitations";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "invitations"
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint

GRANT ALL ON TABLE "invitations" TO spechive_app;--> statement-breakpoint

-- SECURITY DEFINER: validate invite token (public endpoint, bypasses RLS)
CREATE OR REPLACE FUNCTION validate_invitation_token(p_token text)
RETURNS TABLE(
  invitation_id uuid,
  organization_id uuid,
  organization_name varchar,
  organization_slug varchar,
  email varchar,
  role public.membership_role,
  status public.invitation_status,
  expires_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT i.id, i.organization_id, o.name, o.slug, i.email, i.role, i.status, i.expires_at
  FROM public.invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = p_token;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION validate_invitation_token(text) TO spechive_app;--> statement-breakpoint

-- SECURITY DEFINER: register user via invitation (bypasses RLS)
CREATE OR REPLACE FUNCTION register_user_with_invite(
  p_user_id uuid,
  p_membership_id uuid,
  p_email text,
  p_password_hash varchar(255),
  p_name text,
  p_invitation_id uuid
)
RETURNS TABLE(user_id uuid, membership_id uuid, organization_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_role public.membership_role;
  v_status public.invitation_status;
  v_expires_at timestamptz;
BEGIN
  -- Lock and validate the invitation atomically
  SELECT i.organization_id, i.role, i.status, i.expires_at
    INTO v_org_id, v_role, v_status, v_expires_at
    FROM public.invitations i
   WHERE i.id = p_invitation_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer valid (status: %)', v_status;
  END IF;
  IF v_expires_at < now() THEN
    UPDATE public.invitations SET status = 'expired' WHERE id = p_invitation_id;
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  INSERT INTO public.users (id, email, password_hash, name)
  VALUES (p_user_id, p_email, p_password_hash, p_name);

  INSERT INTO public.memberships (id, organization_id, user_id, role)
  VALUES (p_membership_id, v_org_id, p_user_id, v_role);

  UPDATE public.invitations SET status = 'accepted' WHERE id = p_invitation_id;

  RETURN QUERY SELECT p_user_id, p_membership_id, v_org_id;
END;
$$;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION register_user_with_invite(uuid, uuid, text, varchar(255), text, uuid) TO spechive_app;
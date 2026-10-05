import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
const date = (name: string) => timestamp(name, { withTimezone: true });
export const user = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  createdAt: date("created_at").notNull(),
  updatedAt: date("updated_at").notNull(),
});
export const session = pgTable("auth_session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: date("expires_at").notNull(),
  createdAt: date("created_at").notNull(),
  updatedAt: date("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});
export const account = pgTable("auth_account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: date("access_token_expires_at"),
  refreshTokenExpiresAt: date("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: date("created_at").notNull(),
  updatedAt: date("updated_at").notNull(),
});
export const verification = pgTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: date("expires_at").notNull(),
  createdAt: date("created_at").notNull(),
  updatedAt: date("updated_at").notNull(),
});

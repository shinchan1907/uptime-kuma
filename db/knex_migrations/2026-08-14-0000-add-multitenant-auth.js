/**
 * Multi-tenant SaaS auth foundation.
 *
 * - Adds email / role / verification columns to the `user` table so accounts
 *   can self-register and log in via email + OTP instead of username/password.
 * - Adds an `email_otp` table that stores short-lived, hashed one-time codes.
 *
 * Existing single-admin installs keep working: the first user is promoted to
 * the "admin" role and marked verified in the data patch below.
 */
exports.up = async function (knex) {
    await knex.schema.alterTable("user", function (table) {
        // Email is the new primary login identifier. Nullable + unique so we can
        // backfill existing username-only accounts without a hard failure.
        table.string("email", 255).nullable().unique().collate("utf8_general_ci");
        // "admin" = platform operator (sees /admin), "user" = normal tenant.
        table.string("role", 20).notNullable().defaultTo("user");
        // Email ownership proven via OTP at least once.
        table.boolean("is_verified").notNullable().defaultTo(false);
        // When the account was created (for admin listing / abuse review).
        table.datetime("created_date").nullable();
    });

    await knex.schema.createTable("email_otp", function (table) {
        table.increments("id");
        table.string("email", 255).notNullable();
        // We never store the raw code, only a hash of it.
        table.string("code_hash", 255).notNullable();
        // "login" | "register" — keeps flows from being cross-used.
        table.string("purpose", 20).notNullable().defaultTo("login");
        table.datetime("expires").notNullable();
        table.boolean("consumed").notNullable().defaultTo(false);
        // Guard against brute-forcing a single code.
        table.integer("attempts").notNullable().defaultTo(0);
        table.datetime("created_date").notNullable();
        table.index([ "email", "purpose" ], "email_otp_email_purpose");
    });

    // Promote the first existing account (single-admin installs) to platform admin
    // and mark it verified so the current operator is not locked out after upgrade.
    const firstUser = await knex("user").orderBy("id", "asc").first();
    if (firstUser) {
        await knex("user").where("id", firstUser.id).update({
            role: "admin",
            is_verified: true,
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists("email_otp");
    await knex.schema.alterTable("user", function (table) {
        table.dropColumn("email");
        table.dropColumn("role");
        table.dropColumn("is_verified");
        table.dropColumn("created_date");
    });
};

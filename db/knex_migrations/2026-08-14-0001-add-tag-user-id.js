/**
 * Multi-tenant isolation for tags.
 *
 * Tags were global in Uptime Kuma (shared across all monitors and users). For
 * a multi-tenant SaaS each tag must belong to the tenant that created it, so
 * one tenant cannot see, edit, or delete another tenant's tags.
 *
 * Existing tags are assigned to the first admin account so they are not
 * orphaned after upgrade.
 */
exports.up = async function (knex) {
    await knex.schema.alterTable("tag", function (table) {
        table.integer("user_id").unsigned().nullable()
            .references("id").inTable("user").onDelete("CASCADE").onUpdate("CASCADE");
        table.index("user_id", "tag_user_id");
    });

    const firstAdmin = await knex("user").where("role", "admin").orderBy("id", "asc").first();
    if (firstAdmin) {
        await knex("tag").update({ user_id: firstAdmin.id });
    }
};

exports.down = async function (knex) {
    await knex.schema.alterTable("tag", function (table) {
        table.dropColumn("user_id");
    });
};

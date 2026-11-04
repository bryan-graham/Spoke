/**
 * An organization's own logos (Settings), used in the sidebar when Spoke
 * isn't showing Shore's menu. One row per colour scheme ("light", "dark"),
 * the image kept base64-encoded so it works the same on Postgres and SQLite.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable("organization_logo", table => {
    table.increments();
    table
      .integer("organization_id")
      .references("id")
      .inTable("organization")
      .notNullable();
    table.string("scheme", 8).notNullable();
    table.string("content_type", 64).notNullable();
    table.text("data").notNullable();
    table.timestamp("updated_at").defaultTo(knex.fn.now());
    table.unique(["organization_id", "scheme"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("organization_logo");
};

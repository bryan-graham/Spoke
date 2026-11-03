/**
 * @jest-environment jsdom
 */
import React from "react";
import { mount } from "enzyme";
import CollapsibleCard from "../../src/components/CollapsibleCard";
import Empty from "../../src/components/Empty";

describe("CollapsibleCard", () => {
  it("manages its own open state when not controlled (campaign stats)", () => {
    const card = mount(
      <CollapsibleCard title="Survey Responses">
        <p className="body">stats</p>
      </CollapsibleCard>
    );
    expect(card.find("p.body").length).toBe(1);
    card.find("button").simulate("click");
    expect(card.find("button").prop("aria-expanded")).toBe(false);
  });

  it("can start collapsed", () => {
    const card = mount(
      <CollapsibleCard title="Texter stats" startCollapsed>
        <p className="body">stats</p>
      </CollapsibleCard>
    );
    expect(card.find("p.body").length).toBe(0);
    card.find("button").simulate("click");
    expect(card.find("p.body").length).toBe(1);
  });

  it("marks warning cards with a warning icon", () => {
    const card = mount(
      <CollapsibleCard title="Sending Errors" colorTheme="warning">
        <p>errors</p>
      </CollapsibleCard>
    );
    expect(card.find("svg").length).toBeGreaterThan(1); // warning + chevron
  });
});

describe("Empty", () => {
  it("shows the title, the explanation and the icon", () => {
    const empty = mount(
      <Empty
        title="No campaigns"
        icon={<svg className="icon" />}
        content="Campaigns you create show up here."
      />
    );
    expect(empty.text()).toContain("No campaigns");
    expect(empty.text()).toContain("Campaigns you create show up here.");
    expect(empty.find("svg.icon").length).toBe(1);
    expect(empty.find('[data-test="empty"]').length).toBeGreaterThan(0);
  });
});

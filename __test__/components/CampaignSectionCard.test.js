/**
 * @jest-environment jsdom
 */
import React from "react";
import { mount } from "enzyme";
import CampaignSectionCard from "../../src/components/CampaignSectionCard";

describe("CampaignSectionCard", () => {
  it("shows the title and a status badge", () => {
    const done = mount(
      <CampaignSectionCard title="Basics" status="done" canToggle>
        <p>form</p>
      </CampaignSectionCard>
    );
    expect(done.text()).toContain("Basics");
    expect(done.text()).toContain("Done");
    const todo = mount(<CampaignSectionCard title="Texters" status="todo" />);
    expect(todo.text()).toContain("To do");
    const saving = mount(
      <CampaignSectionCard title="Contacts" status="saving" savePercent={40} />
    );
    expect(saving.text()).toContain("Saving 40%");
  });

  it("opens and closes from the header when it can toggle", () => {
    const onToggle = jest.fn();
    const closed = mount(
      <CampaignSectionCard
        title="Basics"
        status="todo"
        canToggle
        expanded={false}
        onToggle={onToggle}
      >
        <p className="form">form</p>
      </CampaignSectionCard>
    );
    expect(closed.find("p.form").length).toBe(0);
    const header = closed.find("button");
    expect(header.prop("aria-expanded")).toBe(false);
    header.simulate("click");
    expect(onToggle).toHaveBeenCalled();

    const open = mount(
      <CampaignSectionCard title="Basics" status="todo" canToggle expanded>
        <p className="form">form</p>
      </CampaignSectionCard>
    );
    expect(open.find("p.form").length).toBe(1);
    expect(open.find("button").prop("aria-expanded")).toBe(true);
  });

  it("can't be opened when the section is locked", () => {
    const locked = mount(
      <CampaignSectionCard title="Texters" status="done" expanded>
        <p className="form">form</p>
      </CampaignSectionCard>
    );
    expect(locked.find("button").length).toBe(0);
    expect(locked.find("p.form").length).toBe(0);
  });

  it("passes data-test through for Cypress", () => {
    const card = mount(
      <CampaignSectionCard data-test="basics" title="Basics" status="done" />
    );
    expect(card.find('[data-test="basics"]').length).toBeGreaterThan(0);
  });
});

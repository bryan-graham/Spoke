/**
 * @jest-environment jsdom
 */
import React, { useState } from "react";
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import {
  PageHeaderContext,
  PageActions,
  PageDescription
} from "../../../src/components/ShoreShell/PageHeader";
import { TopNavBase } from "../../../src/components/TopNav";

// A minimal shell: the header (TopNav) and the page share the context.
const Shell = ({ children }) => {
  const [actionsNode, setActionsNode] = useState(null);
  const [descriptionNode, setDescriptionNode] = useState(null);
  return (
    <PageHeaderContext.Provider
      value={{
        actionsNode,
        setActionsNode,
        descriptionNode,
        setDescriptionNode
      }}
    >
      <TopNavBase title="Campaigns" />
      <section className="page">{children}</section>
    </PageHeaderContext.Provider>
  );
};

describe("page header slots", () => {
  it("puts a page's actions and description in the header, keeping its handlers", async () => {
    const onClick = jest.fn();
    let wrapper;
    // Attached to the document so React sees the click.
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      wrapper = mount(
        <Shell>
          <p>Body</p>
          <PageDescription>Texting campaigns.</PageDescription>
          <PageActions>
            <button type="button" className="new" onClick={onClick}>
              New campaign
            </button>
          </PageActions>
        </Shell>,
        { attachTo: host }
      );
    });
    wrapper.update();
    const dom = wrapper.find("header").getDOMNode();
    expect(dom.textContent).toContain("Texting campaigns.");
    expect(dom.querySelector("button.new").textContent).toBe("New campaign");
    expect(wrapper.find("section.page").getDOMNode().textContent).toBe("Body");
    dom.querySelector("button.new").click();
    expect(onClick).toHaveBeenCalled();
    wrapper.detach();
    host.remove();
  });

  it("renders in place outside the shell", () => {
    const wrapper = mount(
      <div>
        <PageActions>
          <button type="button">New organization</button>
        </PageActions>
      </div>
    );
    expect(wrapper.text()).toBe("New organization");
  });
});

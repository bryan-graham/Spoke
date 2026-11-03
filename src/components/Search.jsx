import PropTypes from "prop-types";
import React from "react";
import SearchBar from "material-ui-search-bar";
import { v } from "../styles/shore-tokens";

// Shore's search field: round, bordered, on the input colour.
const SEARCH_STYLE = {
  borderRadius: 999,
  boxShadow: "none",
  border: `1px solid ${v("border")}`,
  backgroundColor: v("input"),
  height: 44,
  paddingLeft: 8
};

class Search extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchString: props.searchString
    };
  }

  handleSearchStringChanged = searchString => {
    const trimmedSearchString = searchString.trim();
    if (!!this.state.searchString && !trimmedSearchString) {
      this.props.onSearchRequested(undefined);
    }
    this.setState({ searchString });
  };

  handleSearchRequested = () => {
    this.props.onSearchRequested(this.state.searchString);
  };

  onCancelSearch = () => {
    this.handleSearchStringChanged("");
    this.props.onSearchRequested("");
  };

  render = () => (
    <SearchBar
      onRequestSearch={this.handleSearchRequested}
      onChange={this.handleSearchStringChanged}
      onCancelSearch={this.onCancelSearch}
      value={this.props.searchString}
      placeholder={this.props.hintText || this.props.placeholder}
      style={SEARCH_STYLE}
    />
  );
}

Search.propTypes = {
  searchString: PropTypes.string,
  onSearchRequested: PropTypes.func.isRequired,
  hintText: PropTypes.string,
  placeholder: PropTypes.string
};

export default Search;

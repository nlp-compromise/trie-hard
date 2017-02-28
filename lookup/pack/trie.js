'use strict';
const fns = require('../fns');
const pack = require('./packer');
/*
 A JavaScript implementation of a Trie search datastructure.
  Usage:
      trie = new Trie(dictionary-string);
      bool = trie.isWord(word);
  To use a packed (compressed) version of the trie stored as a string:
      compressed = trie.pack();
      ptrie = new PackedTrie(compressed);
      bool = ptrie.isWord(word)
  Node structure:
    Each node of the Trie is an Object that can contain the following properties:
      '' - If present (with value == 1), the node is a Terminal Node - the prefix
          leading to this node is a word in the dictionary.
      numeric properties (value == 1) - the property name is a terminal string
          so that the prefix + string is a word in the dictionary.
      Object properties - the property name is one or more characters to be consumed
          from the prefix of the test string, with the remainder to be checked in
          the child node.
      '_c': A unique name for the node (starting from 1), used in combining Suffixes.
      '_n': Created when packing the Trie, the sequential node number
          (in pre-order traversal).
      '_d': The number of times a node is shared (it's in-degree from other nodes).
      '_v': Visited in DFS.
      '_g': For singleton nodes, the name of it's single property.
 */

// Create a Trie data structure for searching for membership of strings
// in a dictionary in a very space efficient way.
class Trie {
  constructor(words) {
    this.root = {};
    this.lastWord = '';
    this.suffixes = {};
    this.suffixCounts = {};
    this.cNext = 1;
    this.wordCount = 0;
    this.insertWords(words);
    this.vCur = 0;
  // console.log(this.root.d);
  }
  // Insert words from one big string, or from an array.
  insertWords(words) {
    if (typeof words === 'string') {
      words = words.split(/\n/);
    }
    fns.unique(words);
    for (let i = 0; i < words.length; i++) {
      this.insert(words[i]);
    }
  }

  insert(word) {
    this._insert(word, this.root);
    let lastWord = this.lastWord;
    this.lastWord = word;

    let prefix = fns.commonPrefix(word, lastWord);
    if (prefix === lastWord) {
      return;
    }

    let freeze = this.uniqueNode(lastWord, word, this.root);
    if (freeze) {
      this.combineSuffixNode(freeze);
    }
  }

  _insert(word, node) {
    // Do any existing props share a common prefix?
    let keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
      let prop = keys[i];
      let prefix = fns.commonPrefix(word, prop);
      if (prefix.length === 0) {
        continue;
      }
      // Prop is a proper prefix - recurse to child node
      if (prop === prefix && typeof node[prop] === 'object') {
        this._insert(word.slice(prefix.length), node[prop]);
        return;
      }
      // Duplicate terminal string - ignore
      if (prop === word && typeof node[prop] === 'number') {
        return;
      }
      let next = {};
      next[prop.slice(prefix.length)] = node[prop];
      this.addTerminal(next, word = word.slice(prefix.length));
      delete node[prop];
      node[prefix] = next;
      this.wordCount++;
      return;
    }

    // No shared prefix.  Enter the word here as a terminal string.
    this.addTerminal(node, word);
    this.wordCount++;
  }

  // Add a terminal string to node.
  // If 2 characters or less, just add with value == 1.
  // If more than 2 characters, point to shared node
  // Note - don't prematurely share suffixes - these
  // terminals may become split and joined with other
  // nodes in this part of the tree.
  addTerminal(node, prop) {
    if (prop.length <= 1) {
      node[prop] = 1;
      return;
    }
    let next = {};
    node[prop[0]] = next;
    this.addTerminal(next, prop.slice(1));
  }

  // Well ordered list of properties in a node (string or object properties)
  // Use nodesOnly==true to return only properties of child nodes (not
  // terminal strings.
  nodeProps(node, nodesOnly) {
    let props = [];
    for (let prop in node) {
      if (prop !== '' && prop[0] !== '_') {
        if (!nodesOnly || typeof node[prop] === 'object') {
          props.push(prop);
        }
      }
    }
    props.sort();
    return props;
  }

  optimize() {
    this.combineSuffixNode(this.root);
    this.prepDFS();
    this.countDegree(this.root);
    this.prepDFS();
    this.collapseChains(this.root);
  }

  // Convert Trie to a DAWG by sharing identical nodes
  combineSuffixNode(node) {
    // Frozen node - can't change.
    if (node._c) {
      return node;
    }
    // Make sure all children are combined and generate unique node
    // signature for this node.
    let sig = [];
    if (this.isTerminal(node)) {
      sig.push('!');
    }
    let props = this.nodeProps(node);
    for (let i = 0; i < props.length; i++) {
      let prop = props[i];
      if (typeof node[prop] === 'object') {
        node[prop] = this.combineSuffixNode(node[prop]);
        sig.push(prop);
        sig.push(node[prop]._c);
      } else {
        sig.push(prop);
      }
    }
    sig = sig.join('-');

    let shared = this.suffixes[sig];
    if (shared) {
      return shared;
    }
    this.suffixes[sig] = node;
    node._c = this.cNext++;
    return node;
  }

  prepDFS() {
    this.vCur++;
  }

  visited(node) {
    if (node._v === this.vCur) {
      return true;
    }
    node._v = this.vCur;
    return false;
  }

  countDegree(node) {
    if (node._d === undefined) {
      node._d = 0;
    }
    node._d++;
    if (this.visited(node)) {
      return;
    }
    let props = this.nodeProps(node, true);
    for (let i = 0; i < props.length; i++) {
      this.countDegree(node[props[i]]);
    }
  }

  // Remove intermediate singleton nodes by hoisting into their parent
  collapseChains(node) {
    let prop,
      props,
      child,
      i;
    if (this.visited(node)) {
      return;
    }
    props = this.nodeProps(node);
    for (i = 0; i < props.length; i++) {
      prop = props[i];
      child = node[prop];
      if (typeof child !== 'object') {
        continue;
      }
      this.collapseChains(child);
      // Hoist the singleton child's single property to the parent
      if (child._g !== undefined && (child._d === 1 || child._g.length === 1)) {
        delete node[prop];
        prop += child._g;
        node[prop] = child[child._g];
      }
    }
    // Identify singleton nodes
    if (props.length === 1 && !this.isTerminal(node)) {
      node._g = prop;
    }
  }

  isWord(word) {
    return this.isFragment(word, this.root);
  }

  isTerminal(node) {
    return !!node[''];
  }

  isFragment(word, node) {
    if (word.length === 0) {
      return this.isTerminal(node);
    }

    if (node[word] === 1) {
      return true;
    }
    // Find a prefix of word reference to a child
    let props = this.nodeProps(node, true);
    for (let i = 0; i < props.length; i++) {
      let prop = props[i];
      if (prop === word.slice(0, prop.length)) {
        return this.isFragment(word.slice(prop.length), node[prop]);
      }
    }
    return false;
  }

  // Find highest node in Trie that is on the path to word
  // and that is NOT on the path to other.
  uniqueNode(word, other, node) {
    let props = this.nodeProps(node, true);
    for (let i = 0; i < props.length; i++) {
      let prop = props[i];
      if (prop === word.slice(0, prop.length)) {
        if (prop !== other.slice(0, prop.length)) {
          return node[prop];
        }
        return this.uniqueNode(word.slice(prop.length),
          other.slice(prop.length),
          node[prop]);
      }
    }
    return undefined;
  }

  pack() {
    return pack(this);
  }
}

module.exports = Trie;

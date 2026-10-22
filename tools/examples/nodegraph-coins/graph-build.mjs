// Tiny builder that writes graphs in litegraph's serialisation (what the Graph editor saves) from Nord's node specs.
import { NODES } from '../../../runtime/core/graph/nodes.js';

export class GraphBuilder {
  constructor(vars = {}) { this.nodes = []; this.links = []; this.nid = 0; this.lid = 0; this.vars = vars; }
  /** Add a node; `props` override property/widget defaults. */
  node(type, pos, props = {}) {
    const s = NODES[type]; if (!s) throw new Error(`unknown node ${type}`);
    const properties = {};
    const widgets = [];
    for (const [k, v] of Object.entries(s.props)) { properties[k] = k in props ? props[k] : Array.isArray(v) ? v[0] : v; widgets.push(properties[k]); }
    for (const [name, type2, d] of s.in) {
      if (type2 === 'exec' || d === undefined || name in properties) continue;
      properties[name] = name in props ? props[name] : d; widgets.push(properties[name]);
    }
    for (const [k, v] of Object.entries(props)) if (!(k in properties)) properties[k] = v; // extra values for unconnected inputs without widgets
    const slots = Math.max(s.in.length, s.out.length);
    const n = {
      id: ++this.nid, type, pos, size: [230, 30 + slots * 20 + widgets.length * 24], flags: {}, order: 0, mode: 0,
      inputs: s.in.map(([name, t]) => ({ name, type: t, link: null, ...(t === 'exec' ? { shape: 5 } : {}) })),
      outputs: s.out.map(([name, t]) => ({ name, type: t, links: null, ...(t === 'exec' ? { shape: 5 } : {}) })),
      properties, widgets_values: widgets,
    };
    this.nodes.push(n); return n;
  }
  link(a, out, b, inp) {
    const o = a.outputs.findIndex((x) => x.name === out), i = b.inputs.findIndex((x) => x.name === inp);
    if (o < 0 || i < 0) throw new Error(`bad link ${a.type}.${out} -> ${b.type}.${inp}`);
    const id = ++this.lid;
    this.links.push([id, a.id, o, b.id, i, a.outputs[o].type]);
    b.inputs[i].link = id; (a.outputs[o].links ??= []).push(id);
    return this;
  }
  toJSON() {
    return { last_node_id: this.nid, last_link_id: this.lid, nodes: this.nodes, links: this.links, groups: [], config: {}, extra: {}, version: 0.4, nord: { version: 1, vars: this.vars } };
  }
}

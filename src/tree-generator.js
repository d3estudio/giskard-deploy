var tree = require('ascii-tree');

var generateTree = (arr) => {
    var groups = {
        name: 'Projects',
        children: []
    };
    var generateRawTree = (child, level) => {
        level = level || 1;
        var input = '';
        if (child.name !== '/') {
            input = '#'.repeat(level) + child.name;
        }
        if (!child.children.length) {
            input += ` (${child.path})`;
        }
        input += "\n" + child.children.map(c => generateRawTree(c, level + 1)).join('');
        return input + "\n";
    };
    arr.sort()
        .forEach(p => {
            var components = p.split('/');
            var target = groups;
            for (var i = 0; i < components.length; i++) {
                var name = components[i];
                var t = target.children.find(x => x.name === name);
                if (t) {
                    target = t;
                    continue;
                }

                var newItem = {
                    name,
                    children: [],
                    parent: target,
                    path: (() => {
                        var parent = target;
                        var tree = [];
                        while (parent) {
                            if (parent.name !== 'Projects') {
                                tree.push(parent.name);
                            }
                            parent = parent.parent;
                        }
                        return (tree.length ? tree.reverse().join('/') + '/' : '') + name;
                    })()
                };
                target.children.push(newItem);
                target = newItem;
            }
        });
    return generateRawTree(groups);
};

module.exports = (arr) => tree.generate(generateTree(arr.map(p => p.name)));

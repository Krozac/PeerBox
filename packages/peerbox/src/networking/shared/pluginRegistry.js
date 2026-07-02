
export default function createPluginRegistry() {
  const plugins = new Map();

    return {
        registerPlugin(plugin) {
            if (plugins.has(plugin.name)) {
                throw new Error(`Plugin with name ${plugin.name} is already registered.`);
            }

            plugins.set(plugin.name, plugin);
        },

        getPlugin(name) {
            return plugins.get(name);
        },
        
        getAllPlugins() {
            return Array.from(plugins.values());
        } 
        
    }
}


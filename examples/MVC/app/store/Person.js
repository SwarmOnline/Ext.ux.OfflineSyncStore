Ext.define('Example.store.Person', {

    extend: 'Ext.ux.OfflineSyncStore',

    config: {
        model: 'Example.model.Person',

        autoSync: true,

        localProxy: {
            type: 'localstorage',
            id: 'offline-sync-store'
        },

        serverProxy: {
            type: 'ajax',
            api: {
                read: '../../server/select.php',
                create: '../../server/save.php'
            },
            reader: {
                type: 'json',
                rootProperty: 'rows'
            },
            writer: {
                allowSingle: false
            }
        }
    },

    initialize: function () {
        this.loadLocal();
    }
});
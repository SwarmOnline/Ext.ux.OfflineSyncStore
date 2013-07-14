Ext.define('Example.model.Person', {
    extend: 'Ext.data.Model',

    requires: ['Ext.data.identifier.Uuid'],

    config: {
        idProperty: 'PersonID',
        identifier: 'uuid',
        fields: [
            {
                name: 'PersonID'
            },
            {
                name: 'FirstName',
                type: 'string'
            },
            {
                name: 'LastName',
                type: 'string'
            },
            {
                name: 'Email',
                type: 'string'
            }
        ]
    }
})
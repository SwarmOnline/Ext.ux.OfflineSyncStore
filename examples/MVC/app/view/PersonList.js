Ext.define('Example.view.PersonList', {

    extend: 'Ext.dataview.List',

    alias: 'widget.personlist',

    config: {
        itemTpl: '{FirstName} {LastName}, {Email}',
        store: 'Person'
    }
});
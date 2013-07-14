Ext.define('Example.controller.People', {

    extend: 'Ext.app.Controller',

    config: {

        views: ['Example.view.PersonForm'],

        control: {
            'button[action=add]': {
                tap: 'add'
            },
            'button[action=save]': {
                tap: 'save'
            }
        },

        refs: {
            personForm: 'personform'
        }
    },

    add: function () {

        Ext.Viewport.add({
            xtype: 'personform',
            centered: true,
            width: '75%',
            height: '350px'
        });
    },

    save: function () {
        var values = this.getPersonForm().getValues(),
            person = Ext.create('Example.model.Person', values),
            store = Ext.getStore('Person');

        store.add(person);

        this.getPersonForm().destroy();
    }
});
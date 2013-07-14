Ext.define('Example.view.PersonForm', {
    extend: 'Ext.form.Panel',

    alias: 'widget.personform',

    requires: ['Ext.field.Email'],

    config: {
        defaults: {
            labelAlign: 'top'
        },
        items: [
            {
                xtype: 'textfield',
                name: 'FirstName',
                label: 'First Name'
            },
            {
                xtype: 'textfield',
                name: 'LastName',
                label: 'Last Name'
            },
            {
                xtype: 'emailfield',
                name: 'Email',
                label: 'Email'
            },
            {
                xtype: 'button',
                ui: 'confirm',
                action: 'save',
                text: 'Add Person'
            }
        ]
    }
});
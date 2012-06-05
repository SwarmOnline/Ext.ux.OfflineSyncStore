Ext.define('Person', {
	extend: 'Ext.data.Model',

	config: {
		idProperty: 'PersonID',
		fields: [{
			name: 'PersonID',
			type: 'int'
		}, {
			name: 'FirstName',
			type: 'string'
		}, {
			name: 'LastName',
			type: 'string'
		}, {
			name: 'Email',
			type: 'string'
		}]
	}
});
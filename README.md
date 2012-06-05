* Ext.ux.OfflineSyncStore

This class allows you to create a store with two Proxies that will allow offline storage much simpler and easier to handle.

The store is configured with a Local Proxy and a Server Proxy which means that a local copy of the data is always persisted with the changes that haven't been
synced with the server also retained. This means that you can easily sync all outstanding changes to the server (using the Server Proxy) when you want.

This makes offline/online management of data to be far easier as a single copy of the data is always maintained in local storage and a Server synchronisation
can be done at any time, either when the app comes back online, in a batch after a certain amount of time or, if the app is online, then straight away.
export const TEST_DB_NAME = "evencio-marketing-tools"

export const deleteDatabase = (name: string) =>
	new Promise<void>((resolve, reject) => {
		if (typeof indexedDB === "undefined") {
			resolve()
			return
		}
		const request = indexedDB.deleteDatabase(name)
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
		request.onblocked = () => resolve()
	})

export const resetIndexedDb = async () => {
	await deleteDatabase(TEST_DB_NAME)
}

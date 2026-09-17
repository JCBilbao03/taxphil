/** Export only the signed-in user's old browser books; never imports or modifies them. */
export function exportPersonalBooks(uid: string) {
  const raw = localStorage.getItem(`ubb-accounting-v1:${uid}`)
  if (!raw) throw Error('No previous personal books were found for this account in this browser.')
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = 'ubb-previous-personal-books.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

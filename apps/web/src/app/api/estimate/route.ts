export async function POST() {
  return Response.json({ error: 'Estimates are not available yet.' }, { status: 501 })
}

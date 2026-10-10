export async function POST() {
  return Response.json({ error: 'Lead capture is not available yet.' }, { status: 501 })
}

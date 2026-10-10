export async function POST() {
  return Response.json({ error: 'The Cal.com webhook is not available yet.' }, { status: 501 })
}

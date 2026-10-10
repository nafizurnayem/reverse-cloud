export async function POST() {
  return Response.json({ error: 'Booking confirmation is not available yet.' }, { status: 501 })
}

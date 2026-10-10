export async function GET() {
  return Response.json({ error: 'Scheduling is not available yet.' }, { status: 501 })
}

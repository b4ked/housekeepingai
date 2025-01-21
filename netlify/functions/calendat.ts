import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

export const handler: Handler = async (event) => {
  try {
    // Extract room ID and token from path
    const pathParts = event.path.split('/').filter(Boolean);
    const roomId = pathParts[pathParts.length - 2];
    const token = pathParts[pathParts.length - 1];

    if (!roomId || !token) {
      console.error('Missing parameters:', { path: event.path, roomId, token });
      return {
        statusCode: 400,
        body: 'Missing room ID or token'
      };
    }

    // Verify room and token
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select(`
        name,
        cleaning_schedules (
          ical_content
        )
      `)
      .eq('id', roomId)
      .eq('calendar_feed_token', token)
      .single();

    if (roomError || !room) {
      console.error('Room not found:', { roomId, token, error: roomError });
      return {
        statusCode: 404,
        body: 'Calendar not found'
      };
    }

    const icalContent = room.cleaning_schedules?.[0]?.ical_content;
    if (!icalContent) {
      return {
        statusCode: 404,
        body: 'No calendar content found'
      };
    }

    // Return the iCalendar content with proper headers
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${room.name.toLowerCase().replace(/\s+/g, '-')}-schedule.ics"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      },
      body: icalContent
    };
  } catch (error) {
    console.error('Calendar generation error:', error);
    return {
      statusCode: 500,
      body: 'Failed to generate calendar'
    };
  }
};
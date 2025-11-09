import { supabase } from './server/supabase';

async function checkSupabaseData() {
  console.log('Checking Supabase data...\n');
  
  // Check projects
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('=== PROJECTS ===');
  if (projError) {
    console.error('Error fetching projects:', projError);
  } else {
    console.log(`Found ${projects?.length || 0} projects`);
    console.log(JSON.stringify(projects, null, 2));
  }
  
  // Check threads
  const { data: threads, error: threadError } = await supabase
    .from('threads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\n=== THREADS ===');
  if (threadError) {
    console.error('Error fetching threads:', threadError);
  } else {
    console.log(`Found ${threads?.length || 0} threads`);
    console.log(JSON.stringify(threads, null, 2));
  }
  
  // Check messages
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('\n=== MESSAGES ===');
  if (msgError) {
    console.error('Error fetching messages:', msgError);
  } else {
    console.log(`Found ${messages?.length || 0} messages`);
    console.log(JSON.stringify(messages, null, 2));
  }
  
  // Check events
  const { data: events, error: evtError } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log('\n=== EVENTS ===');
  if (evtError) {
    console.error('Error fetching events:', evtError);
  } else {
    console.log(`Found ${events?.length || 0} events`);
    console.log(JSON.stringify(events, null, 2));
  }
  
  // Check artifacts
  const { data: artifacts, error: artError } = await supabase
    .from('artifact_versions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\n=== ARTIFACTS ===');
  if (artError) {
    console.error('Error fetching artifacts:', artError);
  } else {
    console.log(`Found ${artifacts?.length || 0} artifacts`);
    console.log(JSON.stringify(artifacts, null, 2));
  }
}

checkSupabaseData().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

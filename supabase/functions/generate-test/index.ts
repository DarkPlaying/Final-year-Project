import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { syllabusId, prompt } = await req.json();
    console.log('Generating test for syllabus:', syllabusId, 'with prompt:', prompt);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get syllabus content
    const { data: syllabus, error: syllabusError } = await supabaseClient
      .from('syllabi')
      .select('*')
      .eq('id', syllabusId)
      .single();

    if (syllabusError || !syllabus) {
      console.error('Syllabus not found:', syllabusError);
      return new Response(
        JSON.stringify({ error: 'Syllabus not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found syllabus:', syllabus.name);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Generate test questions using AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert teacher creating exam questions. You will receive syllabus content and a prompt from a teacher describing what kind of test questions they need.

Your task is to:
1. Parse the syllabus content to understand the course material
2. Generate relevant test questions based on the teacher's prompt
3. Return the questions in a structured JSON format

Always return valid JSON with the following structure:
{
  "questions": [
    {
      "question": "Question text here",
      "type": "2-mark" | "5-mark" | "10-mark" | "multiple-choice",
      "marks": number,
      "unit": "Unit name/number",
      "answer": "Answer/explanation here (optional)",
      "options": ["A", "B", "C", "D"] (only for multiple-choice)
    }
  ]
}

Make sure questions are:
- Relevant to the syllabus content
- Clear and well-formed
- Appropriate for the marks assigned
- Cover the units/topics requested by the teacher`
          },
          {
            role: 'user',
            content: `Syllabus: ${syllabus.name}\nSubject: ${syllabus.subject || 'Not specified'}\n\nSyllabus Content:\n${syllabus.content || 'No content available'}\n\nTeacher's Request:\n${prompt}\n\nPlease generate the test questions as specified.`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    const generatedContent = aiData.choices[0].message.content;
    console.log('Generated content:', generatedContent);

    // Parse the JSON response
    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Try to extract JSON from the response if it's wrapped in text
      const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedQuestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    }

    return new Response(
      JSON.stringify({ questions: parsedQuestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-test function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

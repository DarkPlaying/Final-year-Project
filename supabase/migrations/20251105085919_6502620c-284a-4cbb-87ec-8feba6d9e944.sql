-- Create teachers table for teacher management
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Teachers viewable by authenticated users
CREATE POLICY "Teachers are viewable by authenticated users" 
ON public.teachers 
FOR SELECT 
TO authenticated
USING (true);

-- Only admins and teachers can insert teachers
CREATE POLICY "Admins and teachers can insert teachers" 
ON public.teachers 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

-- Only admins can update teachers
CREATE POLICY "Admins can update teachers" 
ON public.teachers 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete teachers
CREATE POLICY "Admins can delete teachers" 
ON public.teachers 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create syllabi table for AI document processing
CREATE TABLE IF NOT EXISTS public.syllabi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT,
  file_path TEXT,
  google_drive_link TEXT,
  content TEXT, -- Parsed document content for AI
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;

-- Syllabi viewable by authenticated users
CREATE POLICY "Syllabi are viewable by authenticated users" 
ON public.syllabi 
FOR SELECT 
TO authenticated
USING (true);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Teachers and admins can insert syllabi" ON public.syllabi;
DROP POLICY IF EXISTS "Teachers and admins can update syllabi" ON public.syllabi;
DROP POLICY IF EXISTS "Teachers and admins can delete syllabi" ON public.syllabi;

-- Create new policies using has_role for consistency
CREATE POLICY "Teachers and admins can insert syllabi" 
ON public.syllabi 
FOR INSERT 
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)
);

CREATE POLICY "Teachers and admins can update syllabi" 
ON public.syllabi 
FOR UPDATE 
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)
);

CREATE POLICY "Teachers and admins can delete syllabi" 
ON public.syllabi 
FOR DELETE 
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)
);

-- Create generated_tests table for AI-generated tests
CREATE TABLE IF NOT EXISTS public.generated_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  syllabus_id UUID REFERENCES public.syllabi(id) ON DELETE CASCADE,
  content JSONB NOT NULL, -- Stores questions and answers
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.generated_tests ENABLE ROW LEVEL SECURITY;

-- Generated tests viewable by authenticated users
CREATE POLICY "Generated tests are viewable by authenticated users" 
ON public.generated_tests 
FOR SELECT 
TO authenticated
USING (true);

-- Teachers and admins can insert generated tests
CREATE POLICY "Teachers and admins can insert generated tests" 
ON public.generated_tests 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

-- Teachers and admins can delete generated tests
CREATE POLICY "Teachers and admins can delete generated tests" 
ON public.generated_tests 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_syllabi_updated_at
  BEFORE UPDATE ON public.syllabi
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add username columns to existing tables
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE NOT NULL DEFAULT email;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE NOT NULL DEFAULT email;

-- Update the handle_new_user function to include username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    username,
    department,
    role
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.raw_user_meta_data->>'department',
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  -- If the user is a student, also create a student record
  IF (NEW.raw_user_meta_data->>'role')::app_role = 'student' THEN
    INSERT INTO public.students (
      id,
      name,
      username,
      email,
      student_id,
      grade_level,
      created_by
    )
    VALUES (
      gen_random_uuid(),
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'student_id', 'TBD'),
      NEW.raw_user_meta_data->>'grade_level',
      NEW.id
    );
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  RETURN NEW;
END;
$$;

-- Add indexes for username fields
CREATE INDEX idx_students_username ON public.students(username);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_teachers_username ON public.teachers(username);

-- Add comments for documentation
COMMENT ON COLUMN public.students.username IS 'Unique username for student login';
COMMENT ON COLUMN public.profiles.username IS 'Unique username for user login';
COMMENT ON COLUMN public.teachers.username IS 'Unique username for teacher login';

-- Create function to delete users (handles cascade deletion)
-- This function is SECURITY DEFINER, meaning it runs with the privileges of the user who created it (e.g., supabase_admin).
-- This allows it to bypass RLS policies on tables it needs to modify.
-- We will create wrapper RPCs for specific roles (e.g., teachers) to call this function with additional checks.
CREATE OR REPLACE FUNCTION public.delete_user_cascade(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth -- Include auth schema for auth.users
AS $$
DECLARE
    target_user_role app_role;
    target_user_email text;
BEGIN
    -- Get user's role and email from profiles table (more reliable for app_role)
    SELECT p.role, u.email INTO target_user_role, target_user_email
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE p.id = user_id;

    IF target_user_role IS NULL THEN
        RAISE EXCEPTION 'User with ID % not found in profiles.', user_id;
    END IF;

    -- Delete from specific role table if it exists
    IF target_user_role = 'student' THEN
        DELETE FROM public.students WHERE email = target_user_email; -- Delete by email as student.id is not auth.users.id
    ELSIF target_user_role = 'teacher' THEN
        DELETE FROM public.teachers WHERE email = target_user_email; -- Delete by email as teacher.id is not auth.users.id
    END IF;

    -- Delete from user_roles
    DELETE FROM public.user_roles WHERE user_id = user_id;
    
    -- Delete from profiles
    DELETE FROM public.profiles WHERE id = user_id;
    
    -- Finally, delete from auth.users using the admin function for full cleanup
    PERFORM auth.admin.delete_user(user_id);
END;
$$;

-- Create RPC function for teachers/admins to add a student
CREATE OR REPLACE FUNCTION public.add_student_by_teacher(
    p_department TEXT DEFAULT NULL,
    p_email TEXT NOT NULL,
    p_full_name TEXT NOT NULL,
    p_grade_level TEXT DEFAULT NULL,
    p_password TEXT NOT NULL,
    p_student_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    new_user_id UUID;
    existing_user_id UUID;
BEGIN
    -- Check if the caller is a teacher or admin
    IF NOT (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role)) THEN
        RAISE EXCEPTION 'Permission denied. Only teachers or administrators can add students.';
    END IF;

    -- Check if a user with this email already exists in auth.users
    SELECT id INTO existing_user_id FROM auth.users WHERE email = p_email;
    IF existing_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'A user with email % already exists.', p_email;
    END IF;

    -- Using auth.admin.create_user to create the user and trigger handle_new_user
    -- This requires the function to be SECURITY DEFINER and have access to auth schema
    -- The handle_new_user trigger will populate public.profiles, public.user_roles, and public.students
    SELECT (auth.admin.create_user(
        jsonb_build_object(
            'email', p_email,
            'password', p_password,
            'user_metadata', jsonb_build_object(
                'full_name', p_full_name,
                'role', 'student', -- Enforce student role
                'department', p_department,
                'student_id', COALESCE(p_student_id, 'TBD'),
                'grade_level', p_grade_level
            )
        )
    ))->>'id' INTO new_user_id;

    RETURN new_user_id;
END;
$$;

-- Create RPC function for teachers/admins to delete a student
CREATE OR REPLACE FUNCTION public.delete_student_by_teacher(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    target_user_role app_role;
    current_user_id UUID := auth.uid();
BEGIN
    -- Check if the caller is a teacher or admin
    IF NOT (has_role(current_user_id, 'teacher'::app_role) OR has_role(current_user_id, 'admin'::app_role)) THEN
        RAISE EXCEPTION 'Permission denied. Only teachers or administrators can delete students.';
    END IF;

    -- Prevent a user from deleting their own account
    IF p_user_id = current_user_id THEN
        RAISE EXCEPTION 'You cannot delete your own account.';
    END IF;

    -- Get the role of the user to be deleted from public.profiles
    SELECT role INTO target_user_role FROM public.profiles WHERE id = p_user_id;

    IF target_user_role IS NULL THEN
        RAISE EXCEPTION 'User with ID % not found in profiles.', p_user_id;
    END IF;

    -- Ensure only student users can be deleted by this function
    IF target_user_role <> 'student' THEN
        RAISE EXCEPTION 'Permission denied. Only student users can be deleted via this function.';
    END IF;

    -- Call the cascade delete function
    PERFORM public.delete_user_cascade(p_user_id);
END;
$$;

-- Enable realtime for real-time updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.teachers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.syllabi;
ALTER PUBLICATION supabase_realtime ADD TABLE public.generated_tests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
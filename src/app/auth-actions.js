'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: `ERROR: ${error.message}` }
  }

  revalidatePath('/analyze', 'layout')
  redirect('/analyze')
}

export async function signup(formData) {
  const supabase = await createClient()

  const email = formData.get('email')
  const password = formData.get('password')
  const confirmPassword = formData.get('confirmPassword')

  if (password !== confirmPassword) {
    return { error: 'ERROR: passwords do not match' }
  }

  const data = {
    email,
    password,
  }

  const { data: signUpData, error } = await supabase.auth.signUp(data)

  if (error) {
    return { error: `ERROR: ${error.message}` }
  }

  if (signUpData?.user && signUpData?.session === null) {
    return { error: "INFO: Registration successful! Please check your email to confirm your account before logging in (or disable 'Confirm email' in Supabase Auth settings)." }
  }

  revalidatePath('/analyze', 'layout')
  redirect('/analyze')
}

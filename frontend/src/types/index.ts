export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ItemStatus = 'pending' | 'processing' | 'success' | 'error';

export interface Job {
  id: string;
  status: JobStatus;
  input_type: string;
  input_url: string;
  parent_folder_id: string | null;
  parent_folder_url: string | null;
  languages: string[];
  comments: string | null;
  error_message: string | null;
  total_images: number;
  processed_images: number;
  failed_images: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  items?: JobItem[];
}

export interface JobItem {
  id: string;
  job_id: string;
  image_name: string;
  image_id: string;
  mime_type: string;
  language: string;
  status: ItemStatus;
  model_used: string | null;
  error_message: string | null;
  output_file_id: string | null;
  output_file_url: string | null;
  output_folder_id: string | null;
  output_folder_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

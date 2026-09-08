import streamlit as st
from google import genai
import os

# Set page config
st.set_page_config(
    page_title="Gemini Multi-Agent System",
    page_icon="🤖",
    layout="wide"
)

st.title("🤖 Multi-Agent System with Google Gemini")
st.markdown("Run your multi-agent system powered by Gemini models.")

# Sidebar configuration
with st.sidebar:
    st.header("⚙️ API Configuration")
    
    # Check for secret or manual entry
    api_key = st.text_input("Gemini API Key", type="password", help="Enter your Google AI Studio API key")
    model_choice = st.selectbox("Select Model", ["gemini-2.5-flash", "gemini-2.5-pro"])
    
    st.divider()
    st.markdown("[Get a Gemini API Key](https://aistudio.google.com/)")

# User prompt input
prompt = st.text_area("Enter your prompt for the agents:", placeholder="e.g., Analyze the benefits of multi-agent AI systems...")

if st.button("🚀 Run Agent", type="primary"):
    if not api_key:
        st.error("Please provide a Gemini API Key in the sidebar.")
    elif not prompt:
        st.warning("Please enter a prompt.")
    else:
        try:
            # Initialize Gemini Client
            client = genai.Client(api_key=api_key)
            
            with st.status("Agent thinking...", expanded=True) as status:
                st.write("📡 Connecting to Gemini API...")
                
                # Generate content from Gemini
                response = client.models.generate_content(
                    model=model_choice,
                    contents=prompt
                )
                
                status.update(label="Response generated successfully!", state="complete", expanded=False)

            st.subheader("📌 Agent Output")
            st.markdown(response.text)
            
        except Exception as e:
            st.error(f"An error occurred: {str(e)}")

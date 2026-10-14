type EmailInput={to:string;subject:string;html:string};

export async function sendRLTNLEmail(input:EmailInput){
  const key=process.env.RESEND_API_KEY;
  const from=process.env.RLTNL_FROM_EMAIL||process.env.PRODUCTION_ERROR_ALERT_FROM;
  if(!key||!from) throw new Error("RLTNL email delivery is not configured. Configure RESEND_API_KEY and a verified RLTNL_FROM_EMAIL sender before sending email.");
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({from,to:[input.to],subject:input.subject,html:input.html})
  });
  if(!response.ok){
    const detail=await response.text().catch(()=>"");
    throw new Error(`RLTNL invitation email could not be sent${detail?`: ${detail}`:"."}`);
  }
}
